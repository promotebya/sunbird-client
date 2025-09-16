
import { Button, StyleSheet, Text, View } from 'react-native';

import { createUserWithEmailAndPassword } from 'firebase/auth';

import { auth } from '../firebaseConfig';



export default function RegisterScreen() {

  const demoRegister = async () => {

    // replace with real form

    await createUserWithEmailAndPassword(auth, 'demo@example.com', 'demopassword');

  };



  return (

    <View style={styles.c}>

      <Text style={styles.t}>Register</Text>

      <Button title="Demo register" onPress={demoRegister} />

    </View>

  );

}



const styles = StyleSheet.create({

  c: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  t: { fontSize: 24, fontWeight: '700' },

});