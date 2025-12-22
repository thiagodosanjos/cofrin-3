import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { login, sendPasswordReset } from "../services/auth";
import { useGoogleAuth } from "../services/googleAuth";

// Design System Roxo Premium
const LOGIN_COLORS = {
  primary: '#5B3CC4',      // roxo principal
  primaryDark: '#4A2FA8',  // roxo escuro
  primaryLight: '#7B5CD6', // roxo claro
  gradient: '#F9F8FD',     // off-white arroxeado
};

export default function Login({ navigation }: any) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const { request, promptAsync, isAuthenticating: googleLoading } = useGoogleAuth();

  const loading = emailLoading || googleLoading;

  async function handleLogin() {
    setError(null);
    setEmailLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      const code: string = err?.code || "";
      let message = err?.message || "Ocorreu um erro ao tentar entrar.";

      if (code.includes("auth/user-not-found")) {
        message = "Usuário não encontrado. Verifique seu email.";
      } else if (code.includes("auth/wrong-password")) {
        message = "Senha incorreta. Tente novamente ou recupere a senha.";
      } else if (code.includes("auth/invalid-email")) {
        message = "Email inválido. Verifique o formato do email.";
      } else if (code.includes("auth/invalid-credential")) {
        message = "Usuário ou senha inválidos. Tente novamente ou clique em 'Esqueci minha senha'.";
      } else if (code.includes("auth/network-request-failed")) {
        message = "Sem conexão. Verifique sua internet e tente novamente.";
      }

      setError(message);
    } finally {
      setEmailLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setError(null);
    if (!request) return;
    try {
      await promptAsync();
    } catch (err: any) {
      setError("Erro ao entrar com Google. Tente novamente.");
    }
  }

  async function handleSendReset() {
    setResetResult(null);
    setResetLoading(true);
    try {
      const target = resetEmail?.trim() || email?.trim();
      if (!target) {
        setResetResult("Por favor informe o e-mail para recuperação.");
        return;
      }
      await sendPasswordReset(target);
      setResetResult("Link de recuperação enviado. Verifique sua caixa de entrada.");
      setShowReset(false);
    } catch (err: any) {
      const code: string = err?.code || "";
      let message = err?.message || "Erro ao enviar o link de recuperação.";
      if (code.includes("auth/user-not-found")) {
        message = "Usuário não encontrado. Verifique o email informado.";
      }
      setResetResult(message);
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header com ícone e título */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="piggy-bank" size={64} color="#fff" />
          </View>
          <Text style={styles.appName}>Cofrin</Text>
          <Text style={styles.tagline}>
            Controle financeiro pessoal
          </Text>
        </View>

        {/* Card de Login */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bem-vindo de volta!</Text>

          <View style={[
            styles.inputContainer,
            { borderColor: focusedField === 'email' ? LOGIN_COLORS.primary : '#E0E0E0' }
          ]}>
            <MaterialCommunityIcons name="email-outline" size={20} color="#6B6B6B" style={styles.inputIcon} />
            <TextInput
              placeholder="Email"
              placeholderTextColor="#6B6B6B"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
              editable={!loading}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          <View style={[
            styles.inputContainer,
            { borderColor: focusedField === 'password' ? LOGIN_COLORS.primary : '#E0E0E0' }
          ]}>
            <MaterialCommunityIcons name="lock-outline" size={20} color="#6B6B6B" style={styles.inputIcon} />
            <TextInput
              placeholder="Senha"
              placeholderTextColor="#6B6B6B"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              style={styles.input}
              editable={!loading}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
            />
            <Pressable
              onPress={() => setShowPassword((s) => !s)}
              style={styles.eyeButton}
              accessibilityLabel={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              <MaterialCommunityIcons 
                name={showPassword ? "eye-off" : "eye"} 
                size={20} 
                color="#6B6B6B" 
              />
            </Pressable>
          </View>

          <Pressable
            onPress={() => { setShowReset(!showReset); if (!showReset) setResetEmail(email); }}
            style={styles.forgotPasswordLink}
          >
            <Text style={styles.forgotPasswordText}>{showReset ? "Fechar" : "Esqueci minha senha"}</Text>
          </Pressable>

          {showReset && (
            <View style={styles.resetContainer}>
              <View style={[
                styles.inputContainer,
                { borderColor: focusedField === 'resetEmail' ? LOGIN_COLORS.primary : '#E0E0E0' }
              ]}>
                <MaterialCommunityIcons name="email-outline" size={20} color="#6B6B6B" style={styles.inputIcon} />
                <TextInput
                  placeholder="Digite seu e-mail"
                  placeholderTextColor="#6B6B6B"
                  value={resetEmail}
                  onChangeText={setResetEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                  onFocus={() => setFocusedField('resetEmail')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
              <Pressable
                onPress={handleSendReset}
                style={({ pressed }) => [
                  styles.resetButton, 
                  pressed && styles.buttonPressed, 
                  resetLoading && styles.buttonDisabled
                ]}
                disabled={resetLoading}
              >
                {resetLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.resetButtonText}>Enviar link de recuperação</Text>
                )}
              </Pressable>
              {resetResult && <Text style={styles.helperText}>{resetResult}</Text>}
            </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            onPress={handleLogin}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
              loading && styles.buttonDisabled,
            ]}
            disabled={loading}
          >
            {emailLoading ? (
              <View style={styles.buttonContent}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={[styles.primaryButtonText, { marginLeft: 8 }]}>Entrando...</Text>
              </View>
            ) : (
              <View style={styles.buttonContent}>
                <MaterialCommunityIcons name="login" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.primaryButtonText}>Entrar</Text>
              </View>
            )}
          </Pressable>

          <Pressable
            onPress={handleGoogleLogin}
            style={({ pressed }) => [
              styles.googleButton,
              pressed && styles.buttonPressed,
              (!request || loading) && styles.buttonDisabled,
            ]}
            disabled={!request || loading}
          >
            {googleLoading ? (
              <View style={styles.buttonContent}>
                <ActivityIndicator color="#2E2E2E" size="small" />
                <Text style={[styles.googleButtonText, { marginLeft: 8 }]}>Conectando...</Text>
              </View>
            ) : (
              <View style={styles.buttonContent}>
                <MaterialCommunityIcons name="google" size={20} color="#2E2E2E" style={{ marginRight: 8 }} />
                <Text style={styles.googleButtonText}>Continuar com Google</Text>
              </View>
            )}
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable onPress={() => navigation.navigate("Crie uma conta")} style={styles.registerButton}>
            <Text style={styles.registerText}>
              Não tem conta? <Text style={styles.registerTextBold}>Criar agora</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Overlay de Loading Fullscreen */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={LOGIN_COLORS.primary} />
            <Text style={styles.loadingText}>
              {emailLoading ? 'Autenticando...' : 'Conectando com Google...'}
            </Text>
            <Text style={styles.loadingSubtext}>
              Aguarde um momento
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#5B3CC4',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 24,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'center',
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#F7F6F2',
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
    ...Platform.select({
      web: {
        maxWidth: 460,
        alignSelf: 'center',
        width: '100%',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#2E2E2E',
    textAlign: 'center',
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: Platform.select({ ios: 2, default: 0 }),
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#2E2E2E',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  eyeButton: {
    padding: 8,
    marginLeft: 4,
  },
  forgotPasswordLink: {
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: 16,
    paddingVertical: 4,
  },
  forgotPasswordText: {
    color: '#5B3CC4',
    fontWeight: '600',
    fontSize: 14,
  },
  resetContainer: {
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  resetButton: {
    backgroundColor: '#7B5CD6',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  resetButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  error: {
    color: '#C4572D',
    marginBottom: 12,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  helperText: {
    color: '#6B6B6B',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#5B3CC4',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  googleButton: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.12)',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  googleButtonText: {
    color: '#2E2E2E',
    fontWeight: '600',
    fontSize: 15,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  dividerText: {
    paddingHorizontal: 16,
    color: '#6B6B6B',
    fontSize: 13,
  },
  registerButton: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  registerText: {
    color: '#6B6B6B',
    fontSize: 14,
  },
  registerTextBold: {
    color: '#5B3CC4',
    fontWeight: '700',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    minWidth: 200,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#2E2E2E',
    textAlign: 'center',
  },
  loadingSubtext: {
    marginTop: 4,
    fontSize: 13,
    color: '#6B6B6B',
    textAlign: 'center',
  },
});
