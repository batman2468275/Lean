# Testing the iPad and phone fix (John)

1. Push the repo, then wait a minute for GitHub Pages.
2. On your **iPad** and your **phone**, open these in order and tell me what each looks like (clean, or speckled, and where):
   1. https://batman2468275.github.io/Lean/#/customize?color=sky  (the new default)
   2. https://batman2468275.github.io/Lean/?gl=old#/customize?color=sky  (the old behaviour: confirms the problem shows on this device)
3. If the new default is still speckled, try these one at a time (note the `?gl=` comes **before** the `#`) and say which one cleans it up:
   - https://batman2468275.github.io/Lean/?gl=noshadow#/customize?color=sky
   - https://batman2468275.github.io/Lean/?gl=nodomfx#/customize?color=sky
   - https://batman2468275.github.io/Lean/?gl=noenv#/customize?color=sky
4. Open https://batman2468275.github.io/Lean/?debug=gl#/customize?color=sky and send me a screenshot of the report box at the bottom (the "Copy report" button copies the same text).
5. On the **phone**, scroll a long page (for example `#/models`) and say whether the flicker is gone.
