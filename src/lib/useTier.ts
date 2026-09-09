// useTier — React view of the capability ladder's current tier.
// useSyncExternalStore with a "full" server snapshot: the server render
// and the hydrating client render agree, then the store's real value
// takes over and every capability:change (network, battery, the footer
// toggle) re-renders subscribers.
import { useSyncExternalStore } from "react";
import { getTier, subscribeTier, type Tier } from "./capability";

const subscribe = (onChange: () => void) => subscribeTier(onChange);
const getServerSnapshot = (): Tier => "full";

export function useTier(): Tier {
  return useSyncExternalStore(subscribe, getTier, getServerSnapshot);
}
