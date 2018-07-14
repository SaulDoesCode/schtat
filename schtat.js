(() => {
  const NodeEnv = typeof global === 'object'
  const root = NodeEnv ? global : typeof window === 'object' && window

  const runAsync = NodeEnv ? root.setImmediate : root.requestIdleCallback
    ? root.requestIdleCallback : setTimeout

  const isPromise = o => typeof o === 'object' && isFunc(o.then)
  const isFunc = o => o instanceof Function
  const isObj = o => typeof o === 'object' && o.constructor === Object
  const isStr = o => typeof o === 'string'
  const isRegExp = o => o instanceof RegExp

  const define = (obj, props) => {
    for (const key in props) {
      Object.defineProperty(obj, key, {
        value: props[key],
        enumerable: false,
        configurable: false
      })
    }
    return obj
  }

  const binder = () => {
    const binder = {
      binds: new Map(),
      bound: new Set(),
      get (host, key) {
        if (binder.binds.has(host)) {
          return binder.binds.get(host).get(key)
        }
      },
      set (host, key, bind, imediate) {
        if (!binder.binds.has(host)) {
          binder.binds.set(host, new Map())
        }
        binder.bound.add(bind)
        binder.binds.get(host).set(key, bind)
        if (imediate) runAsync(bind)
      },
      delete (host, key) {
        if (binder.binds.has(host)) {
          binder.bound.delete(binder.binds.get(host).get(key))
          binder.binds.get(host).delete(key)
          if (!binder.binds.get(host).size) {
            binder.binds.delete(host)
          }
        }
      },
      update: runAsync.bind(null, () => {
        binder.bound.forEach(bind => bind())
      }),
      clear () {
        binder.bound.forEach(bind => bind.revoke())
        binder.bound.clear()
        binder.binds.forEach(hostmap => hostmap.clear())
        binder.clear()
      }
    }
    return binder
  }

  const state = ({
    val,
    history,
    maxhistory,
    pre,
    prescreen,
    screen,
    mutate: mut,
    fail,
    views,
    revoked
  }) => {
    if (history === true) history = []
    let isRevoked = false
    const Binds = binder()

    /*
      TemperatureState.bind(
        node, // host
        'textContent', // key - key to bind state to
        'Celius', // =viewName - name of state view to use
        () => console.log('revoked'), // revoke - called on bind.revoke()
      )
    */
    const bind = (host, key, viewName, revoke) => {
      const viewBound = isStr(viewName)
      if (viewBound && !(viewName in view)) {
        throw new Error('state.bind: cannot create bind to undefined view')
      }
      let bind
      if (isFunc(key)) {
        bind = viewBound ? () => key(host, view[viewName]) : () => key(host, val)
      } else {
        bind = viewBound ? () => { host[key] = view[viewName] } : () => { host[key] = val }
      }
      bind.revoke = () => {
        Binds.delete(host, key)
        if (revoke) revoke()
      }
      Binds.set(host, key, bind, val != null)
      return bind
    }

    bind.input = (input, revoke) => {
      const bind = () => { input.value = val }
      const onchange = e => { mutate(input.value.trim()) }
      input.addEventListener('input', onchange)
      bind.revoke = () => {
        input.removeEventListener('input', onchange)
        Binds.delete(input, 'value')
        if (revoke) revoke()
      }
      Binds.set(input, 'value', bind, val != null)
      return bind
    }

    // direct text node bind for easily displaying
    // a state in the dom
    const text = (viewName, node, revoke) => {
      if (viewName != null && viewName.appendChild) {
        [node, viewName] = [viewName, undefined]
      }
      const text = new root.Text()
      if (node && node.appendChild) {
        runAsync(() => node.appendChild(text))
      } else if (isFunc(node)) {
        revoke = node
      }
      const b = bind(text, 'textContent', viewName, () => {
        text.textContent = ''
        if (revoke) revoke()
        try {
          text.remove()
        } catch (e) {}
      })
      b.text = text
      return b
    }

    const view = () => val
    const viewKeys = new Set()
    const createView = (key, fn) => {
      if (!isFunc(fn)) throw new TypeError('a view should be a function')
      if (viewKeys.has(key)) throw new Error('state: duplicate view')
      viewKeys.add(key)
      Object.defineProperty(view, key, { get: () => fn(val) })
      text[key] = (node, rev, rin) => text(key, node, rev, rin)
    }

    if (isObj(views)) {
      for (const key in views) createView(key, views[key])
      views = undefined
    }

    if (screen != null && isRegExp(screen)) {
      const regexp = screen
      screen = val => isStr(val) && regexp.test(val)
    }

    const mutate = newval => {
      if (isRevoked || newval === val) return
      if (isFunc(newval)) newval = newval(val)

      if (newval == null) {
        throw new Error('state.mutate: cannot create mutation from undefined')
      } else if (isFunc(newval)) {
        throw new TypeError('state: cannot accept function values')
      }

      if (isPromise(newval)) {
        return newval.then(nv => mutate(nv), err => fail(newval, err))
      }

      if (pre) {
        if (prescreen || !prescreen(newval, val)) {
          fail(newval, new Error('failed prescreen'))
        } else {
          newval = pre(newval, val)
        }
      }

      if (screen && !screen(newval, val)) {
        const err = new Error('failed screening')
        if (fail) fail(newval, err)
        else throw err
      } else {
        val = newval
        Binds.update()
        if (history) {
          history.push(val)
          if (maxhistory != null && history.length > maxhistory) {
            history.shift()
          }
        }
        if (mut) mut(val)
      }
    }

    const manager = define((v, viewName) => {
      if (v != null) mutate(v)
      return v
    }, {
      bind,
      text,
      mutate,
      history,
      view,
      toJSON: view,
      createView,
      binds: Binds,
      revoke () {
        Binds.clear()
        val = undefined
        viewKeys.forEach(key => delete view[key])
        viewKeys.clear()
        isRevoked = true
        if (history) history.length = 0
        if (revoked) revoked()
      }
    })

    return Object.freeze(manager)
  }

  state.collection = (states = Object.create(null)) => {
    if (!isObj(states)) {
      throw new Error('stateCollection needs a model object')
    }

    for (let key in states) {
      if (isObj(states[key])) {
        states[key] = state(states[key])
      }
    }

    return define(states, {
      toObj: () => state.collection.toObj(states),
      mutate (key, val) {
        if (isObj(key)) {
          for (const k in key) {
            if (states[k]) states[k].mutate(key[k])
          }
        } else if (key != null && val != null) {
          states[key].mutate(val)
        }
      },
      reactive () {
        const reactive = {}
        for (const key in states) {
          Object.defineProperty(reactive, key, {
            get: () => states[key].view(),
            set: v => states[key].mutate(v)
          })
        }
        return reactive
      }
    })
  }

  state.collection.toObj = coll => {
    const obj = Object.create(null)
    for (const key in coll) obj[key] = coll[key].view()
    return obj
  }

  typeof module !== 'undefined' ? module.exports = state : typeof define === 'function' && define.amd ? define(['state'], () => state) : root.state = state
})()
