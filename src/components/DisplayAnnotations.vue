<script setup lang="ts">
import {onMounted, ref} from "vue";

defineProps<{
}>()

const urls = new URLSearchParams(window.location.search).getAll('url');

// 2. Reactive map: url → parsed JSONL array
const urlData = ref({});

// 3. Helper to load and parse a JSONL file
async function fetchJsonl(url: string): Promise<object[]> {
  const response = await fetch(url);
  const text = await response.text();
  return text
      .split('\n')
      .filter(Boolean)
      .map(JSON.parse);
}

// 4. Load all URLs and map them to dataMap
onMounted(async () => {
  const entries = await Promise.all(
      urls.map(async (url) => [url, await fetchJsonl(url)])
  );
  // Convert array of [url, data] → object like { url: data }
  urlData.value = Object.fromEntries(entries);
});
</script>

<template>
  <h2>URLs</h2>
  <ul>
    <li v-for="url in urls" :key="url">
      <a :href="url" target="_blank">{{ url }}</a>: {{ urlData[url] ? urlData[url].length : '[loading]' }} annotations
    </li>
  </ul>
</template>

<style>
</style>
