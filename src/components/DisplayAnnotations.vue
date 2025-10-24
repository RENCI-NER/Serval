<script setup lang="ts">
import {onMounted, ref} from "vue";

defineProps<{
}>()

// 1. Get all URLs from the query string.
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
  urlData.value = Object.fromEntries(entries.map(entry => {
    const url = entry[0] as string;
    const lines = entry[1] as object[];

    return [url, lines.map(data => ({
      ...data,
      url,

      // Come up with a title based on the first 100 characters of the text.
      // TODO: renci-ner should produce this itself!
      // Plus GUIDs maybe?
      title: data.text.substring(0, 100),
    }))];
  }));
});

</script>

<template>
  <h2>URLs</h2>
  <ul>
    <template v-for="url in urls" :key="url">
      <template v-if="url in urlData">
        <li>
          <a :href="url" target="_blank">{{ url }}</a>: {{ urlData[url].length }} entries
        </li>
        <ul>
          <ul v-for="entry in urlData[url]" :key="entry.title">
            <code>{{entry.title}}</code>
          </ul>
        </ul>
      </template>
      <template v-else>
        <li><a :href="url" target="_blank">{{url}}</a>: Loading...</li>
      </template>
    </template>
  </ul>
</template>

<style>
</style>
