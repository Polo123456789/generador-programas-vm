<script setup lang="ts">
import {fetchAssingments, type Assingments, type Assignment} from '~/utils/assingments';

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

function updateReadingStudent(assingment: Assingments, value: Assignment) {
    assingment.reading = value
}

function updateSchoolStudent(a: Assignment, value: Assignment) {
    a.student = value.student
    if (value.assistant !== undefined) {
        a.assistant = value.assistant
    }
}
</script>

<template>
    <main class="container">
        <!-- Navigation Header -->
        <nav class="dont-print bg-gray-800 text-white p-4 flex justify-between items-center">
            <h1 class="text-xl font-bold">Generador de Programas</h1>
            <NuxtLink to="/students" class="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors">
                Gestionar Estudiantes
            </NuxtLink>
        </nav>

        <!-- URL Input Section -->
        <div class="dont-print p-4 flex gap-2 items-center">
            <PrintableInput v-model="url" class="flex-1" />
            <Button @click="fetchAllAssingments" :disabled="loadingAssingments">
                Cargar
            </Button>
            <Button @click="assingments = []">
                Borrar
            </Button>
        </div>
        <div v-for="(assingment, idx) in assingments" :key="idx" class="dont-break mb-8">
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
                            <StudentAssigner
                                :model-value="assingment.reading"
                                @update:model-value="(val) => updateReadingStudent(assingment, val)"
                                :week-date="assingment.date"
                                type="reading"
                                :needs-companion="false"
                            />
                        </td>
                    </tr>

                    <!--
                    Segunda Reunion
                -->
                    <tr>
                        <td class="bg-amber-600 text-white font-bold p-1 mt-2" colspan="1">SEAMOS MEJORES MAESTROS</td>
                    </tr>
                    <tr v-for="(a, aIdx) in assingment.school" :key="`main-school-${aIdx}`">
                        <td class="py-1 align-middle">● {{ a.title }} ({{ a.duration }} mins.)</td>
                        <template v-if="a.assistant !== undefined">
                            <td class="text-right pr-2 align-middle whitespace-nowrap">
                                Estudiante:
                            </td>
                            <td class="align-middle">
                                <PrintableInput v-model="a.student" />
                            </td>
                            <td class="align-middle">
                                <div class="flex gap-2 items-center">
                                    <PrintableInput v-model="a.assistant" class="flex-1" />
                                    <StudentAssigner
                                        :model-value="a"
                                        @update:model-value="(val) => updateSchoolStudent(a, val)"
                                        :week-date="assingment.date"
                                        type="school"
                                        :needs-companion="true"
                                        button-only
                                    />
                                </div>
                            </td>
                        </template>
                        <template v-else>
                            <td class="text-right pr-2 align-middle whitespace-nowrap">
                                Estudiante:
                            </td>
                            <td colspan="2" class="align-middle">
                                <StudentAssigner
                                    :model-value="a"
                                    @update:model-value="(val) => updateSchoolStudent(a, val)"
                                    :week-date="assingment.date"
                                    type="school"
                                    :needs-companion="false"
                                />
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
                    <tr v-for="(a, aIdx) in assingment.livingSpeeches" :key="aIdx">
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

        <div class="dont-break mb-8" v-if="assingments.length > 0">
            <table class="w-full border-collapse">
                <thead>
                    <tr>
                        <th colspan="3" class="text-lg bg-amber-700 text-white font-bold p-1 mt-2 border border-black">
                            Seamos Mejores Maestros
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <template v-for="(assingment, idx) in assingments" :key="idx">
                        <tr>
                            <td colspan="3" class="font-bold text-white bg-amber-600 p-1 mt-2 border border-black">
                                {{assingment.date}}
                            </td>
                        </tr>
                        <tr>
                            <td class="border px-2">
                                Lectura
                            </td>
                            <td colspan="2" class="border text-center">
                                {{assingment.reading.student}}
                            </td>
                        </tr>
                        <tr v-for="(a, aIdx) in assingment.school" :key="`school-${idx}-${aIdx}`">
                            <td class="border px-2">
                                {{ a.title }} ({{ a.duration }} mins.)
                            </td>
                            <template v-if="a.assistant !== undefined">
                                <td class="border text-center">
                                    {{a.student}}
                                </td>
                                <td class="border text-center">
                                    {{a.assistant}}
                                </td>
                            </template>
                            <template v-else>
                                <td colspan="2" class="border text-center">
                                    {{a.student}}
                                </td>
                            </template>
                        </tr>
                    </template>
                </tbody>
            </table>
        </div>
    </main>
</template>
