# Schtät is a state manager pronounced sh-tate
NOTE: This is still a WIP, so there may be issues

[![Build Status](https://travis-ci.org/SaulDoesCode/schtat.svg?branch=master)](https://travis-ci.org/SaulDoesCode/schtat)

Schtät is a different approach to state management
that takes a flow/pipeline approach to mutations,
which, then get distributed to various bindings.
(like the observer pattern but with flow and bouncers)

### How Do We manage ze schtät?
Wis a state factory representing a single value
that can be consumed, mutated, pre-screened, screened and observed at any stage
(event sourcing is also possible) to produce consumable views (computed values),
or binds which synchronize a state or state view with a property on any object.

```js
import state from 'schat.js'

const counter = state({
  val: 0,
  screen: val => typeof val === 'number' && !isNaN(val) && val % 1 === 0,
  mut (val) {
    console.log(val)
  },
  fail (val, err) {
    throw new Error(`Value: ${val}, Issue: ${err}`)
  },
  views: {
    display: val => `The current counter value is ${val}.`
  }
})


const counterDisplay = document.querySelector('div.counter')
counter.bind(counterDisplay, 'textContent', 'display')

setInterval(() => counter.mutate(val => val + 1), 500)
```
