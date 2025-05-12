<script>
  import {
    selectedGenera,
    allergenicFilterLevel,
    searchQuery,
    uniqueGenera,
    allergenicityLevels,
  } from "../stores/filterStore";
  import { writable } from "svelte/store";
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";

  // Display options
  export let data = [];

  // Toggle visibility state
  const isVisible = writable(true);

  // Filter mode state
  const filterMode = writable("individual"); // 'individual' or 'group'

  // Handle toggle
  function toggleVisibility() {
    $isVisible = !$isVisible;
  }

  // Toggle filter mode
  function toggleFilterMode() {
    $filterMode = $filterMode === "individual" ? "group" : "individual";
    // Clear current selection when changing modes
    $selectedGenera = [];
  }

  // Initialize uniqueGenera on mount
  onMount(() => {
    if (data && data.length > 0) {
      const genera = [...new Set(data.map((d) => d.genus_name))].sort();
      $uniqueGenera = genera;
    }
  });

  // Toggle genus selection
  function toggleGenus(genus) {
    if ($selectedGenera.includes(genus)) {
      $selectedGenera = $selectedGenera.filter((g) => g !== genus);
    } else {
      $selectedGenera = [...$selectedGenera, genus];
    }
  }

  // Group genera by first letter
  $: groupedGenera = $uniqueGenera.reduce((groups, genus) => {
    const firstLetter = genus.charAt(0).toUpperCase();
    if (!groups[firstLetter]) {
      groups[firstLetter] = [];
    }
    groups[firstLetter].push(genus);
    return groups;
  }, {});

  // Clear all filters
  function clearFilters() {
    $selectedGenera = [];
    $allergenicFilterLevel = null;
    $searchQuery = "";
  }
</script>

<div class="filter-panel">
  <button class="toggle-btn" on:click={toggleVisibility}>
    {$isVisible ? "Hide Filter" : "Show Filter"}
  </button>

  {#if $isVisible}
    <div
      class="filter-content"
      in:fade={{ duration: 200 }}
      out:fade={{ duration: 200 }}
    >
      <div class="filter-header">
        <h3>Filter Trees</h3>
        <button class="clear-btn" on:click={clearFilters}>Clear all</button>
      </div>

      <!-- Search input -->
      <div class="filter-section">
        <label for="tree-search">Search Trees:</label>
        <input
          id="tree-search"
          type="text"
          placeholder="Enter tree name..."
          bind:value={$searchQuery}
        />
      </div>

      <!-- Allergenicity filter -->
      <div class="filter-section">
        <h4>Allergenicity Level</h4>
        <div class="radio-group">
          {#each $allergenicityLevels as level}
            <label class="radio-label">
              <input
                type="radio"
                name="allergenicity"
                value={level.value}
                checked={$allergenicFilterLevel === level.value}
                on:change={() => ($allergenicFilterLevel = level.value)}
              />
              <span class="radio-text">{level.label}</span>
            </label>
          {/each}
        </div>
      </div>

      <!-- Genus filter with toggle mode -->
      <div class="filter-section">
        <div class="filter-header">
          <h4>Tree Names (Genus)</h4>
          <button class="toggle-by-btn" on:click={toggleFilterMode}>
            Toggle-by: {$filterMode === "individual" ? "Individual" : "Group"}
          </button>
        </div>

        {#if $filterMode === "individual"}
          <div class="genera-list">
            {#each $uniqueGenera as genus}
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  checked={$selectedGenera.includes(genus)}
                  on:change={() => toggleGenus(genus)}
                />
                <span class="checkbox-text">{genus}</span>
              </label>
            {/each}
          </div>
        {:else}
          <div class="group-filter">
            {#each Object.keys(groupedGenera).sort() as letter}
              <div class="letter-group">
                <h5>{letter}</h5>
                <div class="group-actions">
                  <button
                    class="group-btn"
                    on:click={() => {
                      // Select all genera in this group
                      const groupGenera = groupedGenera[letter];
                      const allSelected = groupGenera.every((g) =>
                        $selectedGenera.includes(g)
                      );

                      if (allSelected) {
                        // Deselect all in group
                        $selectedGenera = $selectedGenera.filter(
                          (g) => !groupGenera.includes(g)
                        );
                      } else {
                        // Select all in group
                        const newSelection = [...$selectedGenera];
                        groupGenera.forEach((g) => {
                          if (!newSelection.includes(g)) {
                            newSelection.push(g);
                          }
                        });
                        $selectedGenera = newSelection;
                      }
                    }}
                  >
                    {groupedGenera[letter].every((g) =>
                      $selectedGenera.includes(g)
                    )
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                </div>
                <div class="genera-list group-list">
                  {#each groupedGenera[letter] as genus}
                    <label class="checkbox-label">
                      <input
                        type="checkbox"
                        checked={$selectedGenera.includes(genus)}
                        on:change={() => toggleGenus(genus)}
                      />
                      <span class="checkbox-text">{genus}</span>
                    </label>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .filter-panel {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 900;
  }

  .filter-content {
    position: absolute;
    top: 35px;
    right: 0;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    width: 250px;
    max-height: calc(90vh);
    overflow-y: auto;
    padding: 15px;
  }

  .toggle-btn {
    position: absolute;
    top: 0;
    right: 0;
    background-color: #4caf50;
    color: white;
    border: none;
    padding: 5px 10px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .filter-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
  }

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  h4 {
    margin: 0 0 10px;
    font-size: 16px;
    font-weight: 500;
  }

  h5 {
    margin: 10px 0 5px;
    font-size: 14px;
    font-weight: 500;
    background-color: #f5f5f5;
    padding: 3px 8px;
    border-radius: 3px;
  }

  .clear-btn,
  .toggle-by-btn {
    background: none;
    border: none;
    color: #4caf50;
    cursor: pointer;
    font-size: 14px;
    padding: 0;
    text-decoration: underline;
  }

  .filter-section {
    margin-bottom: 20px;
  }

  label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
  }

  input[type="text"] {
    width: 100%;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
  }

  .radio-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .radio-label,
  .checkbox-label {
    display: flex;
    align-items: center;
    cursor: pointer;
  }

  .radio-text,
  .checkbox-text {
    margin-left: 8px;
  }

  .genera-list {
    max-height: 800px;
    overflow-y: auto;
    border: 1px solid #eee;
    padding: 10px;
    border-radius: 4px;
  }

  .group-list {
    max-height: 200px;
  }

  .letter-group {
    margin-bottom: 10px;
  }

  .group-actions {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 5px;
  }

  .group-btn {
    background: #f0f0f0;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 12px;
    cursor: pointer;
  }

  .group-btn:hover {
    background: #e0e0e0;
  }
</style>
