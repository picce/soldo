const it = {
  app: {
    name: 'Soldo',
  },
  nav: {
    label: 'Navigazione principale',
    home: 'Home',
    transactions: 'Movimenti',
    budget: 'Budget',
    stats: 'Statistiche',
    settings: 'Impostazioni',
  },
  pages: {
    home: {
      intro: 'Qui vedrai il riepilogo del periodo, con il grafico delle spese per categoria e i tasti per aggiungere una spesa o un\'entrata.',
    },
    transactions: {
      intro: 'Qui troverai tutti i tuoi movimenti, raggruppati per giorno, con ricerca e filtri.',
    },
    budget: {
      intro: 'Qui potrai impostare un budget mensile, totale o per categoria, e vedere quanto ti resta.',
    },
    stats: {
      intro: 'Qui vedrai come cambiano entrate e uscite nel tempo.',
    },
    settings: {
      intro: 'Qui gestirai categorie, conti, backup e preferenze.',
    },
  },
  pwa: {
    updateTitle: 'Nuova versione disponibile',
    updateContent: 'Aggiorna per usare l\'ultima versione di Soldo.',
    updateAction: 'Aggiorna',
    dismiss: 'Più tardi',
    offlineReady: 'Soldo è pronto per funzionare anche offline.',
    close: 'Chiudi',
  },
}

export type MessageSchema = typeof it

export default it
