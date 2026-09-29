export function formatKmDistance(km: number) {
  if (km < 1) {
    return `${(km * 1000).toFixed(0)} متر`;
  }

  return `${km.toFixed(2)} كم`;
}
