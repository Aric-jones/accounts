Component({
  properties: {
    unitId: { type: String, value: '' },
    adType: { type: String, value: 'banner' },
    theme: { type: String, value: 'light' }
  },
  data: {
    show: true
  },
  methods: {
    onAdError(e) {
      console.warn('广告加载失败:', e.detail)
      this.setData({ show: false })
    },
    onAdLoad() {
      this.setData({ show: true })
    }
  }
})
