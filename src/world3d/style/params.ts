/**
 * Backlog #446 (style frames, throwaway): the URL switches. `?style=a|b|c`
 * picks a take of the finished 3D look (none is today's look), `&time=dusk`
 * its dusk light, `&bench=1` the phone benchmark. Pure.
 */

export type Take = 'a' | 'b' | 'c';
export type TimeOfDay = 'day' | 'dusk';

export interface StyleParams {
  readonly take: Take | null;
  readonly time: TimeOfDay;
  readonly bench: boolean;
}

const TAKES: readonly string[] = ['a', 'b', 'c'];

export function parseStyleParams(search: string): StyleParams {
  const params = new URLSearchParams(search);
  const style = params.get('style');
  return {
    take: style !== null && TAKES.includes(style) ? (style as Take) : null,
    time: params.get('time') === 'dusk' ? 'dusk' : 'day',
    bench: params.get('bench') === '1',
  };
}
