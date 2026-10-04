# Contributing

Thanks for your interest in improving **BazaarLink Auto-Creator**! 🎉

## Ways to contribute

- 🐛 **Report bugs** — open an issue with steps to reproduce, your OS, Node version, and the full error output.
- 💡 **Suggest features** — open an issue describing the problem and your proposed solution.
- 📝 **Improve docs** — fixes to any of the five READMEs are very welcome.
- 🔧 **Send code** — fork, branch, and open a pull request.

## Development setup

```bash
git clone https://github.com/fauzihub13/bazaarlink-auto-creator.git
cd bazaarlink-auto-creator
npm install
node cli.mjs --headful     # a visible run is the fastest way to debug
```

## Pull request guidelines

1. Keep changes focused; one feature or fix per PR.
2. Match the existing code style (ES modules, 2-space indent, no comments unless they add real value).
3. Test your change end to end where possible. If it depends on Turnstile/IP reputation, describe your setup.
4. Update the relevant README(s) if behaviour, flags, or the output format change.
5. Never commit secrets — `results.json` and `.env*` are git-ignored for a reason.

## Commit messages

Use clear, imperative messages, e.g. `fix: retry Turnstile click on slow widgets`.

## Code of conduct

By participating you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).
