import { writable, derived } from "svelte/store";

// Create writable stores for filter state
export const selectedGenera = writable([]);
export const allergenicFilterLevel = writable(null); // null = all, 0 = non-allergenic, 1 = normal, 2 = severe
export const searchQuery = writable("");
export const hoveredNode = writable(null);

// Derived store for highlighted nodes
export const highlightedNodes = derived(
  [selectedGenera, allergenicFilterLevel, searchQuery],
  ([$selectedGenera, $allergenicFilterLevel, $searchQuery]) => {
    return (node) => {
      // If no filters are active, all nodes are highlighted
      if (
        $selectedGenera.length === 0 &&
        $allergenicFilterLevel === null &&
        !$searchQuery
      ) {
        return true;
      }

      // Check genus filter
      const genusMatch =
        $selectedGenera.length === 0 ||
        $selectedGenera.includes(node.genus_name);

      // Check allergenicity filter
      const allergenicMatch =
        $allergenicFilterLevel === null ||
        Number(node.Allergenicity) === $allergenicFilterLevel;

      // Check search query
      const searchMatch =
        !$searchQuery ||
        node.common_name?.toLowerCase().includes($searchQuery.toLowerCase()) ||
        node.genus_name?.toLowerCase().includes($searchQuery.toLowerCase());

      return genusMatch && allergenicMatch && searchMatch;
    };
  }
);

// Store for unique genera in the dataset
export const uniqueGenera = writable([]);

// Store for allergenicity levels with labels
export const allergenicityLevels = writable([
  { value: null, label: "All Trees" },
  { value: 0, label: "Non-Allergenic" },
  { value: 1, label: "Moderate Allergenicity" },
  { value: 2, label: "High Allergenicity" },
]);
