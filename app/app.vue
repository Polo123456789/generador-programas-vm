<script setup lang="ts">
import {fetchAssingments, type Assingments} from './utils/assingments';

const url = useLocalStorage<string>("lastAssingmentsURL", "")
const assingments = useLocalStorage<Assingments[]>("assingments", [])
const loadingAssingments = ref(false)

function fetchAllAssingments() {
    if (!url.value) return
    loadingAssingments.value = true
    fetchAssingments(url.value).then(data => {
        assingments.value = data
    })
    .finally(() => {
        loadingAssingments.value = false
    })
}
</script>

<template>
    <main class="container">
        <div class="dont-print p-4 flex gap-2">
            <PrintableInput v-model="url" />
            <Button @click="fetchAllAssingments" :disabled="loadingAssingments">
                Cargar
            </Button>
            <Button @click="assingments = []">
                Borrar
            </Button>
        </div>
        <div v-for="assingment in assingments" class="dont-break mb-8">
            <table class="w-full border-collapse pt-4">
                <tbody>
                    <!--
                    Introducción
                -->
                    <tr>
                        <td class="font-bold text-lg" colspan="2">{{ assingment.date }} | {{ assingment.assignedReading }}
                        </td>
                        <td class="text-right pr-2">Presidente:</td>
                        <td>
                            <PrintableInput v-model="assingment.president" />
                        </td>
                    </tr>
                    <tr>
                        <td class="py-1" colspan="4">● Canción {{ assingment.songs[0] }} y oración</td>
                    </tr>
                    <tr>
                        <td class="py-1" colspan="4">● Palabras de introducción (1 min.)</td>
                    </tr>

                    <!--
                    Primera Reunion
                -->
                    <tr>
                        <td class="bg-gray-700 text-white font-bold p-1" colspan="1">TESOROS DE LA BIBLIA</td>
                    </tr>
                    <tr>
                        <td class="py-1" colspan="2">● {{ assingment.treasures.title }} ({{ assingment.treasures.duration }}
                            mins.)</td>
                        <td colspan="2">
                            <PrintableInput v-model="assingment.treasures.student" />
                        </td>
                    </tr>
                    <tr>
                        <td class="py-1" colspan="2">● Busquemos perlas escondidas (10 mins.)</td>
                        <td colspan="2">
                            <PrintableInput v-model="assingment.gems.student" />
                        </td>
                    </tr>
                    <tr>
                        <td class="py-1">● Lectura de la Biblia</td>
                        <td class="text-right pr-2">Estudiante:</td>
                        <td colspan="2">
                            <PrintableInput v-model="assingment.reading.student" />
                        </td>
                    </tr>

                    <!--
                    Segunda Reunion
                -->
                    <tr>
                        <td class="bg-amber-600 text-white font-bold p-1 mt-2" colspan="1">SEAMOS MEJORES MAESTROS</td>
                    </tr>
                    <tr v-for="a in assingment.school">
                        <td class="py-1">● {{ a.title }} ({{ a.duration }} mins.)</td>
                        <td class="text-right pr-2">
                            <span v-if="a.assistant !== undefined">
                                Estudiante/Ayudante:
                            </span>
                            <span v-else>
                                Estudiante:
                            </span>
                        </td>
                        <template v-if="a.assistant !== undefined">
                            <td>
                                <PrintableInput v-model="a.student" />/
                            </td>
                            <td>
                                <PrintableInput v-model="a.assistant" />
                            </td>
                        </template>
                        <template v-else>
                            <td colspan="2">
                                <PrintableInput v-model="a.student" />
                            </td>
                        </template>
                    </tr>

                    <!--
                    Tercera Reunion
                -->
                    <tr>
                        <td class="bg-red-800 text-white font-bold p-1 mt-2" colspan="1">NUESTRA VIDA CRISTIANA</td>
                    </tr>
                    <tr>
                        <td class="py-1" colspan="4">● Canción {{ assingment.songs[1] }}</td>
                    </tr>
                    <tr v-for="a in assingment.livingSpeeches">
                        <td class="py-1" colspan="2">● {{ a.title }} ({{ a.duration }} mins.)</td>
                        <td colspan="2">
                            <PrintableInput v-model="a.student" />
                        </td>
                    </tr>
                    <tr>
                        <td class="py-1">● Estudio bíblico de la congregación (30 mins.)</td>
                        <td class="text-right pr-2">Conductor/Lector:</td>
                        <td>
                            <PrintableInput v-model="assingment.book.student" />/
                        </td>
                        <td>
                            <PrintableInput v-model="assingment.book.assistant" />
                        </td>
                    </tr>

                    <!--
                    Conclusión
                -->
                    <tr>
                        <td class="py-1" colspan="4">● Palabras de conclusión (3 mins.)</td>
                    </tr>
                    <tr>
                        <td class="py-1">● Canción {{ assingment.songs[2] }}</td>
                        <td class="text-right pr-2">Oración:</td>
                        <td colspan="2">
                            <PrintableInput v-model="assingment.finalPrayer" />
                        </td>
                    </tr>

                </tbody>
            </table>
        </div>
    </main>
</template>
