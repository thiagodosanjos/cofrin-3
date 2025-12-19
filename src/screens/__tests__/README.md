# Testes da Tela de Registro

## Visão Geral

Este arquivo contém os testes unitários para a tela de registro (`Register.tsx`) do aplicativo Cofrin.

## Cobertura de Testes

### ✅ Renderização (4 testes)
- Verifica se todos os elementos principais são renderizados
- Valida a presença da label de requisitos de senha
- Confirma renderização dos links de navegação

### ✅ Validação de Email (3 testes)
- Email vazio
- Email inválido (formato incorreto)
- Email válido

### ✅ Validação de Senha (4 testes)
- Senha com menos de 6 caracteres (deve falhar)
- Senha com exatamente 6 caracteres (deve passar)
- Senha apenas numérica (deve passar - nova regra)
- Senha apenas com letras minúsculas (deve passar - nova regra)

### ✅ Confirmação de Senha (2 testes)
- Senhas não coincidem (deve mostrar erro)
- Senhas coincidem (deve aceitar)

### ✅ Visibilidade de Senha (2 testes)
- Toggle de visibilidade da senha principal
- Toggle de visibilidade da confirmação de senha

### ✅ Submissão do Formulário (2 testes)
- Chamada do serviço de registro com dados corretos
- Estado de loading durante o processo

### ✅ Tratamento de Erros (6 testes)
- Email já em uso (`auth/email-already-in-use`)
- Senha fraca (`auth/weak-password`)
- Email inválido no Firebase (`auth/invalid-email`)
- Erro de conexão (`auth/network-request-failed`)
- Erros desconhecidos (genérico)
- Limpeza de erro anterior ao tentar novamente

### ✅ Navegação (2 testes)
- Navegação de volta para tela de login
- Navegação para Termos de Uso

### ✅ Estados dos Campos (1 teste)
- Inputs desabilitados durante loading

## Executar os Testes

```bash
# Executar apenas os testes da tela de registro
npm test -- src/screens/__tests__/Register.test.tsx

# Executar com coverage
npm test -- src/screens/__tests__/Register.test.tsx --coverage

# Executar em modo watch
npm test -- src/screens/__tests__/Register.test.tsx --watch
```

## Notas Importantes

### Regras de Validação Atuais
- **Email**: Deve ser um email válido (formato padrão com @)
- **Senha**: Mínimo de 6 caracteres (sem requisito de maiúsculas/minúsculas)
- **Confirmação**: Deve ser idêntica à senha

### Mocks Utilizados
- `../../services/auth` - Mock do serviço de autenticação
- `react-native-safe-area-context` - Mock do SafeAreaView
- `@expo/vector-icons` - Mock dos ícones do Expo

## Total
**26 testes passando** ✅
