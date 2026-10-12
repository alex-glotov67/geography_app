module.exports = {
  plugins: {
    'postcss-preset-mantine': {},
    'postcss-simple-vars': {
      variables: {
        // Межі адаптивності — SPEC 13.4
        'bp-tablet': '40em', // 640 px
        'bp-desktop': '64em', // 1024 px
      },
    },
  },
}
