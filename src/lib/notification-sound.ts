let ctx: AudioContext | null = null;

/**
 * Sonido de aviso de dos tonos ascendentes, generado con Web Audio API
 * (sin archivo de audio que mantener/licenciar). Silencioso si el
 * navegador bloquea audio por no haber interacción previa del usuario.
 */
export function playNotificationSound() {
  try {
    if (!ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AudioCtx();
    }
    const now = ctx.currentTime;
    [880, 1108].forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.12;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    });
  } catch {
    // Sin soporte de audio o bloqueado por el navegador: no pasa nada grave.
  }
}
