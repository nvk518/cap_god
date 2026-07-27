let sharedContext: AudioContext | null = null

function getOrCreateContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null
  }

  if (!sharedContext) {
    const AudioContextCtor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

    if (!AudioContextCtor) {
      return null
    }

    sharedContext = new AudioContextCtor()
  }

  return sharedContext
}

function scheduleTone(
  context: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  gainPeak: number,
): void {
  const oscillator = context.createOscillator()
  const gain = context.createGain()

  oscillator.type = 'square'
  oscillator.frequency.setValueAtTime(frequency, startTime)
  gain.gain.setValueAtTime(0.0001, startTime)
  gain.gain.exponentialRampToValueAtTime(gainPeak, startTime + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)

  oscillator.connect(gain)
  gain.connect(context.destination)

  oscillator.start(startTime)
  oscillator.stop(startTime + duration + 0.02)
}

export async function playCashRegisterChirp(muted: boolean): Promise<void> {
  if (muted) {
    return
  }

  const context = getOrCreateContext()
  if (!context) {
    return
  }

  if (context.state === 'suspended') {
    await context.resume()
  }

  const now = context.currentTime
  scheduleTone(context, 880, now, 0.06, 0.12)
  scheduleTone(context, 1320, now + 0.07, 0.08, 0.1)
  scheduleTone(context, 1760, now + 0.14, 0.1, 0.08)
}

export function suspendAudioContext(): void {
  if (sharedContext && sharedContext.state === 'running') {
    void sharedContext.suspend()
  }
}

export function closeAudioContext(): void {
  if (!sharedContext) {
    return
  }

  void sharedContext.close()
  sharedContext = null
}
