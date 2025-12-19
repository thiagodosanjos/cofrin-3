import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { register } from "../services/auth";

// Cor principal da tela de registro (verde do app)
const REGISTER_COLORS = {
  primary: '#0F9D8C',
  primaryDark: '#0d9488',
  primaryLight: '#14b8a6',
};

export default function Register({ navigation }: any) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  function validateEmail(email: string) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  }

  function isPasswordStrong(pw: string) {
    return pw.length >= 6;
  }

  async function handleRegister() {
    setError(null);

    if (!email.trim() || !validateEmail(email)) {
      setError("Por favor insira um email válido.");
      return;
    }

    if (!isPasswordStrong(password)) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      await register(email.trim(), password);
      // Usuário será redirecionado automaticamente pelo contexto de autenticação
    } catch (err: any) {
      const code: string = err?.code || "";
      let message = err?.message || "Ocorreu um erro ao tentar registrar a conta.";

      if (code.includes("auth/email-already-in-use")) {
        message = "Esse email já está em uso. Tente recuperar a senha ou use outro email.";
      } else if (code.includes("auth/weak-password")) {
        message = "Senha fraca. Use no mínimo 6 caracteres.";
      } else if (code.includes("auth/invalid-email")) {
        message = "Email inválido. Verifique o formato do e-mail.";
      } else if (code.includes("auth/network-request-failed")) {
        message = "Sem conexão. Verifique sua internet e tente novamente.";
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  }



  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header com ícone */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="piggy-bank" size={64} color="#fff" />
          </View>
          <Text style={styles.appName}>Criar Conta</Text>
          <Text style={styles.tagline}>
              Controle financeiro pessoal
          </Text>
        </View>

      {/* Card de Registro */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Preencha seus dados</Text>

        <View style={styles.inputContainer}>
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
          />
        </View>

        <Text style={styles.fieldLabel}>SENHA ( mínimo 6 caracteres )</Text>
        <View style={styles.inputContainer}>
          <MaterialCommunityIcons name="lock-outline" size={20} color="#6B6B6B" style={styles.inputIcon} />
          <TextInput
            placeholder="Senha"
            placeholderTextColor="#6B6B6B"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            style={styles.input}
            editable={!loading}
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

        <View style={styles.inputContainer}>
          <MaterialCommunityIcons name="lock-check-outline" size={20} color="#6B6B6B" style={styles.inputIcon} />
          <TextInput
            placeholder="Confirme sua senha"
            placeholderTextColor="#6B6B6B"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
            style={styles.input}
            editable={!loading}
          />
          <Pressable
            onPress={() => setShowConfirmPassword((s) => !s)}
            style={styles.eyeButton}
            accessibilityLabel={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            <MaterialCommunityIcons 
              name={showConfirmPassword ? "eye-off" : "eye"} 
              size={20} 
              color="#6B6B6B" 
            />
          </Pressable>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          onPress={handleRegister}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.buttonPressed,
            loading && styles.buttonDisabled,
          ]}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.buttonContent}>
              <MaterialCommunityIcons name="account-plus" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.primaryButtonText}>Criar conta</Text>
            </View>
          )}
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable onPress={() => navigation.goBack()} style={styles.loginButton}>
          <Text style={styles.loginText}>
            Já tem conta? <Text style={styles.loginTextBold}>Fazer login</Text>
          </Text>
        </Pressable>

        {/* Link para Termos de Uso */}
        <Pressable onPress={() => navigation.navigate("Termos de Uso")} style={styles.termsButton}>
          <MaterialCommunityIcons name="file-document-outline" size={16} color="#6B6B6B" />
          <Text style={styles.termsText}>Termos de Uso</Text>
        </Pressable>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F9D8C',
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
    backgroundColor: '#EEF1F4',
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
  },
  eyeButton: {
    padding: 8,
    marginLeft: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B6B6B',
    marginBottom: 6,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  error: {
    color: '#dc2626',
    marginBottom: 12,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: '#0F9D8C',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
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
  loginButton: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  loginText: {
    color: '#6B6B6B',
    fontSize: 14,
  },
  loginTextBold: {
    color: '#0F9D8C',
    fontWeight: '700',
  },
  termsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 8,
  },
  termsText: {
    color: '#6B6B6B',
    fontSize: 13,
  },
});
