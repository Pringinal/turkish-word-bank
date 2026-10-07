# Turkish Word Bank

A vocabulary quiz: translate random words Turkish → English or English → Turkish.
Plain HTML/CSS/JS with no build step, so it runs on GitHub Pages as is.

- Turkish answers can be typed with Latin letters (`guzel` = `güzel`, `kirmizi` = `kırmızı`).
- Most words have several meanings; any of them counts, and all are shown after each answer.
- English answers ignore case, punctuation and a leading `to` / `a` / `an` / `the`, and treat
  contractions as their full forms (`I'm` = `im` = `I am`, `don't` = `do not`).
- Wrong answers show a letter-by-letter comparison with the correct word.
- Choose to practise the top 100 / 250 / 500 / 1000 most common words, 500 everyday words
  (food, home, family, travel, weather…), or all of them.
- Skip shows the answer and resets the streak, without counting the word as answered.
- Score and streaks are saved in the browser.
- **Sentences mode:** translate Turkish sentences (easy, medium or hard) by tapping English word tiles
  in the right order. There are always 3–5 extra tiles that don't belong.
- `grammar.html` is a grammar guide (beginner → advanced), linked from the quiz.

## Editing the word list

Edit `words.js`. Each line is `["turkish", "english"]`; use `/` for alternative translations:

```js
["güzel", "beautiful/pretty/nice"],
```

The 500 everyday words are at the end of `words.js`, after the frequency-ranked words.

## Editing the sentences

Edit `sentences.js`. Each line is `[level, turkish, english, ...other word orders]`, where level is
`"e"` (easy), `"m"` (medium) or `"h"` (hard) and the English words become the tiles:

```js
["e", "Bugün çok mutluyum.", "I am very happy today", "today I am very happy"],
```

## License

Copyright © 2026 Zilvinas S. **All rights reserved.** The code and grammar guide may not be
copied, modified, redistributed or hosted elsewhere without written permission.

The word list (`words.js`) is the exception. It is derived from Hermit Dave's
[Turkish frequency list](https://invokeit.wordpress.com/frequency-word-lists/)
and is licensed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).

See [LICENSE](LICENSE) for the full terms.
