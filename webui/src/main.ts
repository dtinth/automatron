import { setup } from 'twind/shim'
import twindtinth from 'twindtinth'
import App from './App.svelte'

setup(twindtinth)

const app = new App({
  target: document.getElementById('app'),
})

export default app
