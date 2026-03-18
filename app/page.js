"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import styles from "./page.module.css";

export default function Home() {
  const router = useRouter();
  const [hasUser, setHasUser] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [timerDone, setTimerDone] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, (user) => {
      setHasUser(!!user);
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setTimerDone(true), 2000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (authChecked && timerDone) {
      if (hasUser) {
        router.replace("/home");
      } else {
        router.replace("/login");
      }
    }
  }, [authChecked, timerDone, hasUser, router]);

  return (
    <main className={styles.page}>
      <div className={styles.loaderContainer}>
        <div className={styles.spinner}></div>
      </div>
    </main>
  );
}
