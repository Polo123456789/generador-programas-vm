<template>
    <header class="print-header px-4 pt-4">
        <div class="flex justify-between items-end border-b-2 border-gray-600 pb-2">
            <span class="font-sans font-bold text-xs">CONGREGACIÓN CASTAÑAS</span>
            <span class="font-serif text-2xl">Programa para la reunión de entre semana</span>
        </div>
    </header>
</template>

<style scoped>
.print-header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background-color: white;
    z-index: 10;
}


@media print {
    .print-header {
        position: fixed;
    }
}
</style>
