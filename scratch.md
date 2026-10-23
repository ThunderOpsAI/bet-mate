I've reviewed the `apps/web/app/blackbook/page.tsx` file to see why the `+` button might be missing for Trainers, Dogs, and other categories in the ranked section.

It turns out the code is currently using a single `.map` loop to render **all** of those categories identically. The logic that outputs the `+` button applies to every single entity in that list, regardless of whether it's a Horse, Jockey, Trainer, or Dog:

```tsx
{["Top 50 Horses", "Top 30 Jockeys", "Top 20 Horse Trainers", "Top 15 Harness Drivers", "Top 10 Harness Trainers", "Top 30 Dog Trainers"].map(cat => {
  const runners = categorizedRunners[cat] || [];
  // ...
      {runners.map(r => {
        // ...
        <button
          onClick={!isAdded ? () => quickAddOrToggle(r.entityName, cat, r.sport || "racing") : undefined}
          disabled={isAdded}
          // ...
        >
          {isAdded ? <CheckCircle2 size={18} /> : <Plus size={18} />}
        </button>
```

If you are not seeing the `+` button on Jockeys, Trainers, and Dogs, it is highly likely that **those sections are currently empty in your local database** and are displaying the `"Updating rankings..."` fallback message instead of the table.

This happens because the ML API endpoints for `/explore/top-harness-drivers`, `/explore/top-harness-trainers`, and `/explore/top-dog-trainers` do not exist yet, causing the seed script to fail and skip inserting those records into your database.

Would you like me to implement those missing endpoints in the Python ML engine (`services/prediction-engine/app/main.py`) so that the seed script can populate them with real data, which will then render the tables and the `+` buttons?
