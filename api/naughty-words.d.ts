// naughty-words ships no types: one word list per language code
declare module 'naughty-words' {
  const lists: Record<string, string[]>;
  export default lists;
}
