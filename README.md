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

## Publishing on GitHub Pages

1. Create a new repository on GitHub and push these files to the `main` branch.
2. In the repository go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, then branch `main` and folder `/ (root)`, and save.
4. After a minute the site is live at `https://<your-username>.github.io/<repo-name>/`.

To try it locally, open `index.html` in a browser.
