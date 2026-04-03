<script>
  import '../app.css';
  import { editorDarkMode } from '$lib/stores/editor-theme';

  let { children } = $props();

  $effect(() => {
    if ($editorDarkMode) {
      document.documentElement.setAttribute('data-editor-dark', '')
    } else {
      document.documentElement.removeAttribute('data-editor-dark')
    }
  })
</script>

{@render children()}
