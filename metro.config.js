const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Otimizações de bundle
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    // Terser options para minificação mais agressiva
    compress: {
      // Remove console.log em produção
      drop_console: process.env.NODE_ENV === 'production',
      // Remove código morto
      dead_code: true,
      // Otimizações de loops
      loops: true,
      // Inline de funções simples
      inline: 2,
    },
    mangle: {
      // Mangle de nomes de variáveis
      toplevel: true,
    },
  },
};

// Resolver otimizações
config.resolver = {
  ...config.resolver,
  // Resolução mais eficiente de módulos
  resolverMainFields: ['react-native', 'browser', 'main'],
};

module.exports = config;
