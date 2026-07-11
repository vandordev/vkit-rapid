import type { Metadata } from "next";
import { ColorSchemeScript, MantineProvider, createTheme } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { Space_Grotesk } from "next/font/google";

import { TRPCProvider } from "@/components/trpc-provider";

import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";

import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "Oriskin Task Management",
  description: "Oriskin internal task-management workspace",
};

const theme = createTheme({
  primaryColor: "oriskin",
  defaultRadius: "md",
  fontFamily: "var(--font-space-grotesk), system-ui, sans-serif",
  headings: {
    fontFamily: "var(--font-space-grotesk), system-ui, sans-serif",
  },
  colors: {
    oriskin: [
      "#fff1f0",
      "#ffe1df",
      "#ffc4bf",
      "#ff9d96",
      "#f87168",
      "#e84f45",
      "#d93a30",
      "#b82d25",
      "#982821",
      "#7e251f",
    ],
  },
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={spaceGrotesk.variable}>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body>
        <MantineProvider defaultColorScheme="light" theme={theme}>
          <TRPCProvider>
            <Notifications position="top-right" />
            {children}
          </TRPCProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
