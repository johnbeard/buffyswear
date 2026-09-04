# Buffy's Swearing Keyboard

An HTML5 + vanilla JavaScript remake of the classic b3ta Flash toy
"Buffy's Swearing Keyboard". Based on the original `buffy.swf` Flash
movie and its decompiled assets.

This is a silly reimplementation of a Flash toy, not a serious project. B3ta,
Joel Veitch, Rob Manuel and whoever else was involved made this and I just
wanted it to work on a phone to explain to the kids these days how fun the
Internet used to be.

See the original Flash toy at https://b3ta.com/buffyswear.

See it online at https://johnbeard.github.io/buffyswear

## Run it

The app is fully static. Because it uses ES modules and `fetch`-free audio
preloading, serve the folder over HTTP (no build step required):

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Any static file server works. Opening `index.html` via `file://` will not work because ES modules require HTTP.

## What next

...nothing? Probalby jsut wait for HTML5 to die and then reimplement it in whatever
comes next?

If you have bug or amazing feature that you simply MUST HAVE!!!!111!!!one, open
an issue or PR or whatever.

Audio for other languages would be fun maybe?