<script lang="ts">
  import { automatronRequest } from './AutomatronClient'
  const commandHistory = automatronRequest('/history', {}).then((response) => {
    return response.data.result.history
  })
</script>

<details>
  <summary>Command history</summary>
  <div>
    {#await commandHistory}
      Loading history
    {:then history}
      {#each history as command}
        <div class="mt-2">
          <div class="nowrap truncate overflow-hidden text-xs text-#8b8685">
            {command.time} via {command.source}
          </div>
          <div class="nowrap truncate overflow-hidden">
            {command.text}
          </div>
        </div>
      {/each}
    {:catch e}
      Error loading history: {String(e)}
    {/await}
  </div>
</details>
