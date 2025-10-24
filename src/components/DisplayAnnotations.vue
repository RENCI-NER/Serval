<script setup lang="ts">
import {onMounted, ref} from "vue";

defineProps<{
}>()

// 1. Get all URLs from the query string.
const urls = new URLSearchParams(window.location.search).getAll('url');

// 2. Reactive map: url → parsed JSONL array
const loaded = ref(false);
const urlData = ref({});
const annotatedTextByTitle = ref({});
const annotatedTextByAnnotationsDescending = ref({});

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
  const entriesByURL = Object.fromEntries(entries.map(entry => {
    const url = entry[0] as string;
    const lines = entry[1] as object[];

    return [url, lines.map(data => ({
      url,
      text: data.text as string,
      annotations: data.annotations as object[],

      // Come up with a title based on the first 100 characters of the text.
      // TODO: renci-ner should produce this itself!
      // Plus GUIDs maybe?
      title: data.text.substring(0, 100) as string,
    }))];
  }));
  urlData.value = entriesByURL;

  // Flatten the data into a single array by title.
  // TODO: this assumes titles are unique!
  annotatedTextByTitle.value = Object.values(entriesByURL).flat().reduce(function (acc, entry) {
    const title = entry.title as string;
    if (!(title in acc)) {
      acc[title] = {
        title: title,
        url: entry.url,
        text: entry.text,
        annotations: [],
      };
    }
    const new_annotations = (entry.annotations || []);
    if (new_annotations.length > 0) {
      console.log(`Found ${new_annotations.length} annotations for ${title} in ${entry.url}`);
      acc[title].annotations.push(...new_annotations);
    }

    return acc;
  }, {});

  annotatedTextByAnnotationsDescending.value = Object.values(annotatedTextByTitle.value).sort((a, b) => b.annotations.length - a.annotations.length);
  loaded.value = true;
});

</script>

<template>
  <h2>URLs</h2>
  <ol v-if="loaded">
    <template v-for="annotatedText in annotatedTextByAnnotationsDescending" :key="title">
      <li v-if="annotatedText"><code>{{annotatedText.title}}</code>: {{annotatedText.annotations.length}} annotations</li>
    </template>
  </ol>
  <ol v-else>
    <li>Loading...</li>
  </ol>
</template>

<style>
</style>
