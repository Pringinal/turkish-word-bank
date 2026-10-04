# Turkish Word Bank

A vocabulary quiz: translate random words Turkish → English or English → Turkish.
Plain HTML/CSS/JS with no build step, so it runs on GitHub Pages as is.

- Turkish answers can be typed with Latin letters (`guzel` = `güzel`, `kirmizi` = `kırmızı`).
- Most words have several meanings; any of them counts, and all are shown after each answer.
- English answers ignore case, punctuation and a leading `to` / `a` / `an` / `the`, and treat
  contractions as their full forms (`I'm` = `im` = `I am`, `don't` = `do not`).
- Wrong answers show a letter-by-letter comparison with the correct word.
- Choose to practise the top 100 / 250 / 500 / 1000 most common words, or all of them.
- Skip shows the answer without counting the word as answered.
- Score and streaks are saved in the browser.
- `grammar.html` is a grammar guide (beginner → advanced), linked from the quiz.

## Editing the word list

Edit `words.js`. Each line is `["turkish", "english"]`; use `/` for alternative translations:

```js
["güzel", "beautiful/pretty/nice"],
```

## License

Copyright © 2026 Zilvinas S. **All rights reserved.** The code and grammar guide may not be
copied, modified, redistributed or hosted elsewhere without written permission.

The word list (`words.js`) is the exception. It is derived from Hermit Dave's
[Turkish frequency list](https://invokeit.wordpress.com/frequency-word-lists/)
and is licensed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).

See [LICENSE](LICENSE) for the full terms.
