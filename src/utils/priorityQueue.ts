export class PriorityQueue<T> {
  #a: T[] = [];
  constructor(private cmp: (x: T, y: T) => number) {}
  push(x: T) { this.#a.push(x); this.#siftUp(); }
  pop(): T | undefined {
    if (this.#a.length === 0) return undefined;
    const top = this.#a[0], last = this.#a.pop()!;
    if (this.#a.length) { this.#a[0] = last; this.#siftDown(); }
    return top;
  }
  get size() { return this.#a.length; }
  #siftUp() {
    let i = this.#a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.cmp(this.#a[p], this.#a[i]) <= 0) break;
      [this.#a[p], this.#a[i]] = [this.#a[i], this.#a[p]];
      i = p;
    }
  }
  #siftDown() {
    let i = 0;
    while (true) {
      let l = i*2+1, r = l+1, m = i;
      if (l < this.#a.length && this.cmp(this.#a[l], this.#a[m]) < 0) m = l;
      if (r < this.#a.length && this.cmp(this.#a[r], this.#a[m]) < 0) m = r;
      if (m === i) break;
      [this.#a[i], this.#a[m]] = [this.#a[m], this.#a[i]];
      i = m;
    }
  }
}
