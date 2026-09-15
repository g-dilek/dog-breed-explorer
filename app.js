// ------------------------------
// Configuration
// ------------------------------

const API_URL = "https://dog-breed-api.cilantrolover.workers.dev/breeds";

// API_KEY comes from config.js
// Make sure config.js is loaded BEFORE this file in index.html.

// ------------------------------
// DOM elements
// ------------------------------

const breedGrid = document.getElementById("breed-grid");
const searchInput = document.getElementById("search-input");
const sortSelect = document.getElementById("sort-select");
const breedCount = document.getElementById("breed-count");
const statusMessage = document.getElementById("status-message");
const loadMoreButton = document.getElementById("load-more-button");

// ------------------------------
// State
// ------------------------------

let allBreeds = [];
let filteredBreeds = [];

let visibleCount = 24;

const CARDS_PER_LOAD = 24;

// ------------------------------
// Fetch all breeds
// ------------------------------

async function fetchAllBreeds() {
  try {
    showStatus("Loading dog breeds...");

    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    allBreeds = await response.json();

    console.log(`Loaded ${allBreeds.length} breeds`);

    filteredBreeds = [...allBreeds];

    sortBreeds();
    renderBreeds();

    statusMessage.textContent = "";
  } catch (error) {
    console.error("Error loading breeds:", error);

    showStatus("Unable to load breeds. Check your API key.", true);
  }
}

// ------------------------------
// Normalize text
// ------------------------------

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ------------------------------
// Levenshtein distance
// ------------------------------

function levenshteinDistance(a, b) {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// ------------------------------
// Determine fuzzy search score
// ------------------------------

function getSearchScore(breedName, query) {
  const name = normalizeText(breedName);
  const search = normalizeText(query);

  if (!search) {
    return 0;
  }

  // --------------------------------
  // Exact full-name match
  // --------------------------------

  if (name === search) {
    return 1000;
  }

  // --------------------------------
  // Direct substring match
  //
  // "collie" matches:
  // "Border Collie"
  // "Bearded Collie"
  // --------------------------------

  if (name.includes(search)) {
    return 900;
  }

  // --------------------------------
  // Individual search words
  // --------------------------------

  const searchWords = search.split(" ");
  const nameWords = name.split(" ");

  // --------------------------------
  // All search words appear somewhere
  //
  // "border collie"
  // --------------------------------

  const allWordsMatch = searchWords.every((word) => name.includes(word));

  if (allWordsMatch) {
    return 850;
  }

  // --------------------------------
  // Fuzzy word matching
  // --------------------------------

  let totalScore = 0;
  let matchedWords = 0;

  for (const searchWord of searchWords) {
    let bestSimilarity = 0;

    for (const nameWord of nameWords) {
      if (!searchWord || !nameWord) {
        continue;
      }

      const distance = levenshteinDistance(searchWord, nameWord);

      const maxLength = Math.max(searchWord.length, nameWord.length);

      if (maxLength === 0) {
        continue;
      }

      const similarity = 1 - distance / maxLength;

      bestSimilarity = Math.max(bestSimilarity, similarity);
    }

    // Only consider reasonably close matches.
    if (bestSimilarity >= 0.7) {
      totalScore += Math.round(bestSimilarity * 700);

      matchedWords++;
    }
  }

  // If not every word matched,
  // this isn't a strong multi-word result.

  if (matchedWords === searchWords.length) {
    return totalScore;
  }

  // For a one-word typo, allow a fuzzy match.

  if (searchWords.length === 1 && matchedWords === 1) {
    return totalScore;
  }

  return 0;
}

// ------------------------------
// Search breeds
// ------------------------------

function searchBreeds(query) {
  const normalizedQuery = normalizeText(query);

  // Empty search = every breed

  if (!normalizedQuery) {
    return [...allBreeds];
  }

  const results = allBreeds
    .map((breed) => ({
      breed,
      score: getSearchScore(breed.name, normalizedQuery),
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => {
      // Highest relevance first

      if (b.score !== a.score) {
        return b.score - a.score;
      }

      // Alphabetical tie-breaker

      return a.breed.name.localeCompare(b.breed.name);
    });

  console.log(`Search "${query}" → ${results.length} matches`);

  console.log(
    results.map((result) => ({
      name: result.breed.name,
      score: result.score,
    }))
  );

  return results.map((result) => result.breed);
}

// ------------------------------
// Search input
// ------------------------------

searchInput.addEventListener("input", () => {
  filteredBreeds = searchBreeds(searchInput.value);

  visibleCount = CARDS_PER_LOAD;

  renderBreeds();
});

// ------------------------------
// Sorting
// ------------------------------

sortSelect.addEventListener("change", () => {
  sortBreeds();

  renderBreeds();
});

function sortBreeds() {
  const sortOrder = sortSelect.value;

  filteredBreeds.sort((a, b) => {
    const nameA = normalizeText(a.name);

    const nameB = normalizeText(b.name);

    if (sortOrder === "name-desc") {
      return nameB.localeCompare(nameA);
    }

    return nameA.localeCompare(nameB);
  });
}

// ------------------------------
// Render breeds
// ------------------------------

function renderBreeds() {
  breedGrid.innerHTML = "";

  const visibleBreeds = filteredBreeds.slice(0, visibleCount);

  breedCount.textContent =
    `Showing ${visibleBreeds.length} of ` + `${filteredBreeds.length} breeds`;

  if (filteredBreeds.length === 0) {
    showStatus("No breeds found. Try a different search.");

    loadMoreButton.style.display = "none";

    return;
  }

  statusMessage.textContent = "";

  visibleBreeds.forEach((breed) => {
    const card = createBreedCard(breed);

    breedGrid.appendChild(card);
  });

  updateLoadMoreButton();
}

// ------------------------------
// Create breed card
// ------------------------------

function createBreedCard(breed) {
  const card = document.createElement("article");

  card.className = "breed-card";

  // ------------------------------
  // Image
  // ------------------------------

  const image = document.createElement("img");

  image.alt = breed.name;

  if (breed.image?.url) {
    image.src = breed.image.url;
  } else {
    image.alt = `${breed.name} (no image available)`;

    image.style.display = "none";
  }

  image.onerror = () => {
    image.style.display = "none";
  };

  // ------------------------------
  // Content
  // ------------------------------

  const content = document.createElement("div");

  content.className = "breed-card-content";

  // ------------------------------
  // Name
  // ------------------------------

  const name = document.createElement("h2");

  name.textContent = breed.name;

  // ------------------------------
  // Temperament
  // ------------------------------

  const temperament = document.createElement("p");

  temperament.className = "breed-description";

  temperament.textContent =
    breed.temperament || "No temperament information available.";

  // ------------------------------
  // Details
  // ------------------------------

  const details = document.createElement("div");

  details.className = "breed-details";

  addDetail(details, "Origin", breed.origin);

  addDetail(details, "Life span", breed.life_span);

  addDetail(details, "Breed group", breed.breed_group);

  addDetail(details, "Bred for", breed.bred_for);

  // ------------------------------
  // Assemble card
  // ------------------------------

  content.appendChild(name);
  content.appendChild(temperament);
  content.appendChild(details);

  card.appendChild(image);
  card.appendChild(content);

  return card;
}

// ------------------------------
// Add detail to card
// ------------------------------

function addDetail(container, label, value) {
  const paragraph = document.createElement("p");

  const strong = document.createElement("strong");

  strong.textContent = label;

  paragraph.appendChild(strong);

  paragraph.appendChild(document.createTextNode(value || "Not available"));

  container.appendChild(paragraph);
}

// ------------------------------
// Load more
// ------------------------------

loadMoreButton.addEventListener("click", () => {
  visibleCount += CARDS_PER_LOAD;

  renderBreeds();
});

function updateLoadMoreButton() {
  if (visibleCount >= filteredBreeds.length) {
    loadMoreButton.disabled = true;

    loadMoreButton.textContent = "All breeds loaded";
  } else {
    loadMoreButton.disabled = false;

    loadMoreButton.textContent = "Load more breeds";
  }

  loadMoreButton.style.display =
    filteredBreeds.length > 0 ? "inline-block" : "none";
}

// ------------------------------
// Status message
// ------------------------------

function showStatus(message, isError = false) {
  statusMessage.textContent = message;

  statusMessage.className = isError ? "status-message error" : "status-message";
}

// ------------------------------
// Start application
// ------------------------------

fetchAllBreeds();
