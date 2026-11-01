"""High-speed vectorized Quasi-Monte Carlo Gaussian Copula pricer using Scrambled Sobol sequences and Cholesky factorization."""
from __future__ import annotations

from typing import Sequence
import numpy as np
from scipy.stats import norm, qmc


class FastCopulaPricer:
    """High-speed vectorized Quasi-Monte Carlo Gaussian Copula pricer."""

    def __init__(self, n_samples: int = 2048):
        self.n_samples = n_samples

    def simulate_joint_probability(
        self,
        marginal_probabilities: Sequence[float] | np.ndarray,
        correlation_matrix: np.ndarray,
        seed: int = 42,
    ) -> float:
        k = len(marginal_probabilities)
        if k == 0:
            return 0.0
        if k == 1:
            return float(np.clip(marginal_probabilities[0], 0.0, 1.0))

        # 1. Transform marginal probabilities to standard normal thresholds
        probs_clipped = np.clip(marginal_probabilities, 1e-5, 1.0 - 1e-5)
        z_thresholds = norm.ppf(probs_clipped)  # Shape: (k,)

        # 2. Perform Cholesky Decomposition of correlation matrix: Sigma = L * L^T
        try:
            L = np.linalg.cholesky(correlation_matrix)
        except np.linalg.LinAlgError:
            # Regularize non-positive definite matrix if needed
            eigval, eigvec = np.linalg.eigh(correlation_matrix)
            eigval = np.maximum(eigval, 1e-5)
            clean_corr = eigvec @ np.diag(eigval) @ eigvec.T
            d = 1.0 / np.sqrt(np.diag(clean_corr))
            clean_corr = d[:, None] * clean_corr * d[None, :]
            L = np.linalg.cholesky(clean_corr)

        # 3. Generate Quasi-Monte Carlo Sobol Sequence (Low-discrepancy)
        sobol = qmc.Sobol(d=k, scramble=True, seed=seed)
        # Power of 2 is optimal for Sobol sequences
        uniform_samples = sobol.random(self.n_samples)

        # 4. Map uniform [0, 1] samples to standard normal via Inverse CDF
        # Shape: (n_samples, k)
        z_standard = norm.ppf(np.clip(uniform_samples, 1e-6, 1.0 - 1e-6))

        # 5. Correlate samples via matrix multiplication: X = Z * L^T
        correlated_samples = z_standard @ L.T

        # 6. Vectorized joint event evaluation
        # Condition holds when all simulated normals fall below their respective marginal thresholds
        joint_successes = np.all(correlated_samples <= z_thresholds, axis=1)
        joint_probability = float(np.mean(joint_successes))

        max_bound = float(min(marginal_probabilities))
        return float(np.clip(joint_probability, 1e-6, max_bound))
