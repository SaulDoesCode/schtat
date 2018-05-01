/*
  NOTE: THIS TEST IS NOT YET COMPLETE
  TODO: Finnish, Fix and Polish
*/

const test = require('ava')
const state = require('./schtat.es5.min.js')

test('state exists and is a function', t => {
  t.is(typeof state, 'function')
})

const counter = state({
  val: 0,
  screen: val => typeof val === 'number' && !isNaN(val) && val % 1 === 0,
  // mutate (val) {},
  // fail (val, err) {},
  views: {
    display: val => `The current counter value is ${val}.`
  }
})

test('.mutate()/.view() exists and runs without error', t => {
  counter.mutate(val => val + 1)
  t.is(counter.view(), 1)
})

test('state screenng works', t => {
  const err = t.throws(() => {
    counter.mutate('not a valid value')
  })
  console.log(err)
  t.is(err.message, 'failed screening')
})

test('state views/displays are working', t => {
  t.is(counter.view.display, `The current counter value is 1.`)
})

test.cb('async state binding is working', t => {
  const viewNode = {
    get textContent () { return viewNode.txt },
    set textContent (val) {
      viewNode.txt = val
      t.is(val, `The current counter value is 55.`)
      t.end()
    }
  }
  counter.bind(viewNode, 'textContent', 'display')
  counter.mutate(55)
})
