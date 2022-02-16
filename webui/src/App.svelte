<script lang="ts">
  import { signInController, currentUserInfo } from './GoogleSignIn'
  import axios from 'axios'
  import { pwaStatus } from './PWAStatus'

  let displayedText = '…'

  const submit: svelte.JSX.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault()
    const form = e.currentTarget
    const text = form.text.value
    displayedText = 'Sending request to automatron...'
    const response = await axios.post(
      '/api/automatron?action=text',
      {
        text: text,
      },
      {
        headers: {
          Authorization: `Bearer ${$currentUserInfo.idToken}`,
        },
      },
    )
    displayedText =
      typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data, null, 2)
  }
</script>

<main class="p-6">
  {#if $currentUserInfo}
    <form class="flex items-flex-end" on:submit={submit}>
      <div class="flex-auto">
        <!-- svelte-ignore a11y-autofocus -->
        <textarea
          name="text"
          type="text"
          class="block w-full bg-emboss rounded border border-#454443 hover:border-#555453 active:border-#8b8685 py-1 px-2 shadow placeholder-#8b8685 font-mono"
          placeholder="Talk to automatron"
          autocomplete="off"
          autofocus={true}
        />
      </div>
      <div class="flex-none ml-2">
        <button
          class="block bg-bevel rounded border border-#454443 hover:border-#555453 active:border-#8b8685 p-2 shadow"
          type="submit"
        >
          <svg width="24" height="24" viewBox="0 0 491.022 491.022">
            <path
              fill="#8b8685"
              d="M490.916,13.991c-0.213-1.173-0.64-2.347-1.28-3.307c-0.107-0.213-0.213-0.533-0.32-0.747
            c-0.107-0.213-0.32-0.32-0.533-0.533c-0.427-0.533-0.96-1.067-1.493-1.493c-0.427-0.32-0.853-0.64-1.28-0.96
            c-0.213-0.107-0.32-0.32-0.533-0.427c-0.32-0.107-0.747-0.32-1.173-0.427c-0.533-0.213-1.067-0.427-1.6-0.533
            c-0.64-0.107-1.28-0.213-1.92-0.213c-0.533,0-1.067,0-1.6,0c-0.747,0.107-1.493,0.32-2.133,0.533
            c-0.32,0.107-0.747,0.107-1.067,0.213L6.436,209.085c-5.44,2.347-7.893,8.64-5.547,14.08c1.067,2.347,2.88,4.373,5.227,5.44
            l175.36,82.453v163.947c0,5.867,4.8,10.667,10.667,10.667c3.733,0,7.147-1.92,9.067-5.12l74.133-120.533l114.56,60.373
            c5.227,2.773,11.627,0.747,14.4-4.48c0.427-0.853,0.747-1.813,0.96-2.667l85.547-394.987c0-0.213,0-0.427,0-0.64
            c0.107-0.64,0.107-1.173,0.213-1.707C491.022,15.271,491.022,14.631,490.916,13.991z M190.009,291.324L36.836,219.218
            L433.209,48.124L190.009,291.324z M202.809,437.138V321.831l53.653,28.267L202.809,437.138z M387.449,394.898l-100.8-53.013
            l-18.133-11.2l-0.747,1.28l-57.707-30.4L462.116,49.298L387.449,394.898z"
            />
          </svg>
        </button>
      </div>
    </form>
    <pre class="my-6" wrap="">{displayedText}</pre>
  {:else}
    <p class="text-center">
      <button
        class="bg-bevel rounded border border-#454443 hover:border-#555453 active:border-#8b8685 px-4 py-1 shadow"
        on:click={() => signInController.signIn()}
      >
        Sign in with Google
      </button>
    </p>
  {/if}
  <div class="mt-6 pt-1 border-t border-#353433 text-#8b8685 flex">
    <div class="flex-auto text-left">
      {$pwaStatus.text}
    </div>
    <div class="flex-auto text-right">
      {#if $currentUserInfo}
        <button
          on:click={() => confirm('Sign out?') && signInController.signOut()}
        >
          {$currentUserInfo.name}
        </button>
      {/if}
    </div>
  </div>
</main>

<style>
</style>
