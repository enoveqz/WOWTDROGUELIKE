/** Statuseffekte, die Gegner (und teilweise den Helden) betreffen. */
export class Status {
  slow = 0;
  slowT = 0;
  stunT = 0;
  rootT = 0;
  burnDps = 0;
  burnT = 0;
  poisonDps = 0;
  poisonT = 0;
  bleedDps = 0;
  bleedT = 0;
  vulnT = 0;
  tauntT = 0;
  tick = 0;

  reset(): void {
    this.slow = this.slowT = this.stunT = this.rootT = 0;
    this.burnDps = this.burnT = this.poisonDps = this.poisonT = 0;
    this.bleedDps = this.bleedT = this.vulnT = this.tauntT = this.tick = 0;
  }

  applySlow(amount: number, dur: number): void {
    if (amount >= this.slow || this.slowT <= 0) {
      this.slow = amount;
      this.slowT = Math.max(this.slowT, dur);
    } else {
      this.slowT = Math.max(this.slowT, dur * 0.5);
    }
  }

  get slowed(): boolean {
    return this.slowT > 0 && this.slow > 0;
  }

  get disabled(): boolean {
    return this.stunT > 0;
  }

  get rooted(): boolean {
    return this.rootT > 0 || this.stunT > 0;
  }

  speedMul(): number {
    if (this.rooted) return 0;
    return this.slowT > 0 ? 1 - Math.min(0.8, this.slow) : 1;
  }

  /** Zählt Timer herunter; liefert DoT-Schaden, der in diesem Frame fällig ist. */
  update(dt: number): number {
    if (this.slowT > 0) this.slowT -= dt;
    if (this.stunT > 0) this.stunT -= dt;
    if (this.rootT > 0) this.rootT -= dt;
    if (this.vulnT > 0) this.vulnT -= dt;
    if (this.tauntT > 0) this.tauntT -= dt;
    let dot = 0;
    this.tick += dt;
    if (this.tick >= 0.5) {
      this.tick -= 0.5;
      if (this.burnT > 0) dot += this.burnDps * 0.5;
      if (this.poisonT > 0) dot += this.poisonDps * 0.5;
      if (this.bleedT > 0) dot += this.bleedDps * 0.5;
    }
    if (this.burnT > 0) this.burnT -= dt;
    if (this.poisonT > 0) this.poisonT -= dt;
    if (this.bleedT > 0) this.bleedT -= dt;
    return dot;
  }
}
