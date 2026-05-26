/**
 * 平台抽象。详见 specs/11-platform.md。
 *
 * 现状只区分 POSIX（macOS / Linux）与 Windows，不细分到 darwin / linux。
 * 区分到 darwin 等更细粒度的需求出现时再扩展。
 */
export type Platform = 'posix' | 'windows'

export function currentPlatform(): Platform {
  return process.platform === 'win32' ? 'windows' : 'posix'
}
