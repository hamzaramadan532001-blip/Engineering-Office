// Mantine's stylesheets wrapped in `@layer mantine`, so a Tailwind utility in a
// later layer wins over Mantine's own rule without needing `!important`.
// The consuming app must declare the layer order (…, mantine, …, utilities).
import "@mantine/core/styles.layer.css";
import "@mantine/dates/styles.layer.css";
import "@mantine/notifications/styles.layer.css";
