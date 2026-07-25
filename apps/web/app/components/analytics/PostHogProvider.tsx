"use client";

import Script from "next/script";

export function PostHogProvider() {
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const posthogHost =
    process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com";

  if (!posthogKey) {
    return null;
  }

  return (
    <Script id="posthog-init" strategy="afterInteractive">
      {`
        !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}var u=e;for("undefined"!=typeof a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},p="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys onSessionId".split(" "),r=0;r<p.length;r++)g(u,p[r]);e._i.push([i,s,a])},e.__SV=1.0,o=t.createElement("script"),o.type="text/javascript",o.async=!0,o.src=s.api_host+"/static/array.js",(n=t.getElementsByTagName("script")[0]).parentNode.insertBefore(o,n))}(document,window.posthog||[]);
        posthog.init('${posthogKey}', {api_host: '${posthogHost}', capture_pageview: false});
      `}
    </Script>
  );
}
