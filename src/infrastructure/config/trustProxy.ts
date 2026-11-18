/** Trust only the configured number of reverse-proxy hops, never every XFF entry. */
export function trustProxyHops(value: string | undefined, production: boolean): number {
  if (!value?.trim()) return production ? 1 : 0;
  const hops = Number(value);
  if (!Number.isSafeInteger(hops) || hops < 0) {
    throw new Error('TRUST_PROXY_HOPS debe ser un entero mayor o igual a cero');
  }
  return hops;
}
