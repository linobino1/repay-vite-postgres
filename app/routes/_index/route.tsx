import type { ActionFunction, LoaderFunctionArgs } from "@remix-run/node";
import {
  json,
  Form,
  NavLink,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import classes from "./index.module.css";
import { Shows } from "~/components/Shows";
import Layout from "~/components/Layout";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { useEffect, useRef, useState } from "react";
import environment from "~/util/environment";
import SocialIcons from "~/components/SocialIcons";

export const loader = async ({ context: { payload } }: LoaderFunctionArgs) => {
  // today, 00:00:00
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const shows = await payload.find({
    collection: "shows",
    sort: "date",
    where: {
      date: {
        greater_than_equal: today,
      },
    },
  });
  return json({ shows }, { status: 200 });
};

const validateCaptcha = async (token: string): Promise<boolean> => {
  if (process.env.NODE_ENV === "development") {
    console.log("Captcha validation skipped in development mode");
    return true;
  }
  try {
    const res = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        secret: process.env.HCAPTCHA_SECRET_KEY,
        sitekey: process.env.HCAPTCHA_SITE_KEY,
        response: token,
      }),
    });
    const data = await res.json();
    return !!data.success;
  } catch (error) {
    return false;
  }
};

export const action: ActionFunction = async ({ context, request }) => {
  const data = await request.formData();

  // validate captcha
  if (!(await validateCaptcha(data.get("h-captcha-response") as string))) {
    return json({
      error: true,
      message: `Please confirm the captcha.`,
    });
  }

  const email = data.get("email");

  let res = await fetch(`${process.env.LISTMONK_API}/public/subscription`, {
    method: "post",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      email,
      list_uuids: [process.env.LISTMONK_LIST_ID],
    }),
  });

  if (res.ok) {
    return json({
      message: `Thanks for signing up! Check your inbox/spam for an email with the confirmation link.`,
      original_response: res.json(),
    });
  } else {
    return json({
      error: true,
      message: `We couldn't sign you up. Please try again.`,
      original_response: res.json(),
    });
  }
};

export default function Index() {
  const { shows } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const state: "idle" | "loading" | "error" | "success" =
    navigation.state === "submitting"
      ? "loading"
      : actionData?.error
      ? "error"
      : actionData?.message
      ? "success"
      : "idle";
  const [isActive, setIsActive] = useState(false);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state === "success") {
      form.current?.reset();
      isActive && setIsActive(false);
    }
  }, [state, isActive]);

  useEffect(() => {
    document.body.onclick = (e) => {
      if (!form.current?.contains(e.target as Node)) {
        setIsActive(false);
      }
    };
  }, [isActive]);

  return (
    <Layout className={classes.container}>
      <h1>Walls & Birds</h1>
      <h2 className={classes.tour}>tour dates</h2>
      <Shows shows={shows} className={classes.shows} />

      <hr />
      <h2>email newsletter</h2>
      <div
        className={`${classes.newsletter} ${isActive ? classes.active : ""}`}
      >
        <Form
          ref={form}
          method="post"
          aria-hidden={state === "success"}
          className={state === "loading" ? classes.loading : ""}
        >
          <fieldset disabled={state === "loading"}>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="sign@me.up"
              aria-label="your email address"
              required={true}
              onFocus={() => setIsActive(true)}
            />
            <button
              className={classes.inlineSubmit}
              type="submit"
              aria-label="sign up for our newsletter"
            >
              &crarr;
            </button>
          </fieldset>
          <div
            className={classes.captcha}
            style={{ display: isActive ? "block" : "none" }}
          >
            <HCaptcha sitekey={environment().HCAPTCHA_SITE_KEY} />
            <p className={classes.error} aria-hidden={state !== "error"}>
              {actionData?.message ||
                "We couldn't sign you up. Please try again."}
              <button onClick={() => setIsActive(false)}>ok</button>
            </p>
            <button
              className={classes.submit}
              type="submit"
              aria-label="sign up for our newsletter"
            >
              sign me up
            </button>
          </div>
        </Form>
        <p className={classes.success} aria-hidden={state !== "success"}>
          {actionData?.message}
        </p>
      </div>

      <hr />
      <h2>
        <a
          href="https://wallsandbirds.bandcamp.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          shop ↗
        </a>
      </h2>
      <hr />
      <SocialIcons />
      <hr />
      <nav className={classes.nav}>
        <a href="mailto:judy@wallsandbirds.com">contact</a>
        <NavLink to="/faq" prefetch="intent">
          faq
        </NavLink>
        <NavLink prefetch="intent" to="/songbook">
          songbook
        </NavLink>
      </nav>
    </Layout>
  );
}
