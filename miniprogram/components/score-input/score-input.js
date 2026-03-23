Component({
  properties: {
    value: { type: Number, value: 0 },
    playerId: { type: String, value: '' },
    step: { type: Number, value: 10 }
  },
  methods: {
    onInput(e) {
      const val = parseInt(e.detail.value) || 0
      this.triggerEvent('change', { playerId: this.properties.playerId, value: val })
    },
    onQuickMinus() {
      const newVal = (this.properties.value || 0) - this.properties.step
      this.triggerEvent('change', { playerId: this.properties.playerId, value: newVal })
    },
    onQuickPlus() {
      const newVal = (this.properties.value || 0) + this.properties.step
      this.triggerEvent('change', { playerId: this.properties.playerId, value: newVal })
    }
  }
})
