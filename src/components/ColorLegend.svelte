<script>
  import { writable } from "svelte/store";
  import { fade } from "svelte/transition";
  import { selectedGenera } from "../stores/filterStore";

  // Props
  export let colorScale;
  export let genera = [];
  export let title = "Tree Genera";

  // Toggle visibility state
  const isVisible = writable(true);

  // Handle toggle
  function toggleVisibility() {
    $isVisible = !$isVisible;
  }

  // Toggle genus selection
  function toggleGenus(genus) {
    if ($selectedGenera.includes(genus)) {
      $selectedGenera = $selectedGenera.filter((g) => g !== genus);
    } else {
      $selectedGenera = [...$selectedGenera, genus];
    }
  }
</script>

<div class="legend-container">
  <button class="toggle-btn" on:click={toggleVisibility}>
    {$isVisible ? "Hide Legend" : "Show Legend"}
  </button>

  {#if $isVisible}
    <div
      class="legend-panel"
      in:fade={{ duration: 200 }}
      out:fade={{ duration: 200 }}
    >
      <h4>{title} ({genera.length} types)</h4>
      <div class="legend-items">
        {#each genera as genus}
          <div class="legend-item">
            <span
              class="color-box"
              style="background-color: {colorScale(genus)}"
              class:selected={$selectedGenera.includes(genus)}
              on:click={() => toggleGenus(genus)}
            ></span>
            <span class="genus-name">{genus}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .legend-container {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 1000;
  }

  .toggle-btn {
    position: absolute;
    top: 0;
    left: 0;
    background-color: #4caf50;
    color: white;
    border: none;
    padding: 5px 10px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .legend-panel {
    position: absolute;
    top: 35px;
    left: 0;
    background: rgba(255, 255, 255, 0.95);
    padding: 10px;
    border-radius: 5px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
    max-height: 90vh;
    width: 200px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #888 #f1f1f1;
  }

  .legend-panel::-webkit-scrollbar {
    width: 8px;
  }

  .legend-panel::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
  }

  .legend-panel::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 4px;
  }

  .legend-panel::-webkit-scrollbar-thumb:hover {
    background: #555;
  }

  h4 {
    margin: 0 0 10px 0;
    font-size: 14px;
    font-weight: 600;
    color: #333;
    position: sticky;
    top: 0;
    background: rgba(255, 255, 255, 0.95);
    padding: 5px 0;
    z-index: 1;
  }

  .legend-items {
    display: flex;
    flex-direction: column;
    gap: 5px;
    overflow-y: visible;
  }

  .legend-item {
    display: flex;
    align-items: center;
    font-size: 12px;
    transition: background-color 0.2s;
    padding: 2px 4px;
    border-radius: 3px;
  }

  .legend-item:hover {
    background-color: #f5f5f5;
  }

  .color-box {
    display: inline-block;
    width: 14px;
    height: 14px;
    margin-right: 8px;
    border-radius: 3px;
    border: 1px solid rgba(0, 0, 0, 0.1);
    cursor: pointer;
    transition: all 0.2s;
  }

  .color-box.selected {
    transform: scale(1.2);
    border: 1px solid rgba(0, 0, 0, 0.3);
    box-shadow: 0 0 4px rgba(0, 0, 0, 0.2);
  }

  .genus-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
