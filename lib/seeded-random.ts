/**
 * Deterministik seed-li PRNG (mulberry32).
 *
 * İSTİFADƏ: lab/demo komponentlərində random data render zamanı yaradılırsa
 * (`useState(() => generate())` və ya render body), `Math.random()` server (SSR) və
 * brauzerdə FƏRQLİ dəyər verir → SSR HTML ilə hidrasiya arasında uyğunsuzluq (React #418).
 *
 * HƏLL nümunəsi:
 *   function generate(rand: () => number = Math.random) { ... rand() ... }
 *   const [data, setData] = useState(() => generate(seededRandom(1))); // ilkin: deterministik
 *   useEffect(() => setData(generate()), []);                          // mount sonrası: real random
 * Belə: SSR + ilk client render EYNİ (seed-li) → #418 yoxdur; sonra brauzerdə randomlaşır.
 */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
