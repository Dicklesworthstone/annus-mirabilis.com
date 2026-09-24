//! Test support: a minimal JSON reader for the envelopes this crate emits and
//! for the recorded vector file, so the tests need no registry dependency.
//! It accepts exactly RFC 8259 JSON and panics with a position on anything
//! else; a malformed envelope is therefore a test failure, not a skip.

#![allow(dead_code)]

use std::collections::BTreeMap;

#[derive(Debug, Clone, PartialEq)]
pub enum Json {
    Null,
    Bool(bool),
    Num(String),
    Str(String),
    Arr(Vec<Json>),
    Obj(BTreeMap<String, Json>),
}

impl Json {
    pub fn get(&self, key: &str) -> &Json {
        match self {
            Json::Obj(m) => m
                .get(key)
                .unwrap_or_else(|| panic!("missing key {key:?} in {self:?}")),
            _ => panic!("not an object: {self:?}"),
        }
    }
    pub fn has(&self, key: &str) -> bool {
        matches!(self, Json::Obj(m) if m.contains_key(key))
    }
    pub fn keys(&self) -> Vec<&str> {
        match self {
            Json::Obj(m) => m.keys().map(String::as_str).collect(),
            _ => panic!("not an object: {self:?}"),
        }
    }
    pub fn str(&self) -> &str {
        match self {
            Json::Str(s) => s,
            _ => panic!("not a string: {self:?}"),
        }
    }
    pub fn arr(&self) -> &[Json] {
        match self {
            Json::Arr(a) => a,
            _ => panic!("not an array: {self:?}"),
        }
    }
    /// The number's literal text, so u64 values are never rounded through f64.
    pub fn num(&self) -> &str {
        match self {
            Json::Num(s) => s,
            _ => panic!("not a number: {self:?}"),
        }
    }
    pub fn u64(&self) -> u64 {
        match self {
            Json::Num(s) | Json::Str(s) => s.parse().unwrap_or_else(|e| panic!("{s:?}: {e}")),
            _ => panic!("not an integer: {self:?}"),
        }
    }
    pub fn f64(&self) -> f64 {
        self.num().parse().unwrap()
    }
}

pub fn parse(text: &str) -> Json {
    let b = text.as_bytes();
    let mut i = 0;
    let v = value(b, &mut i);
    ws(b, &mut i);
    assert_eq!(i, b.len(), "trailing bytes at {i} in {text:?}");
    v
}

fn ws(b: &[u8], i: &mut usize) {
    while *i < b.len() && matches!(b[*i], b' ' | b'\t' | b'\n' | b'\r') {
        *i += 1;
    }
}

fn value(b: &[u8], i: &mut usize) -> Json {
    ws(b, i);
    assert!(*i < b.len(), "unexpected end");
    match b[*i] {
        b'{' => {
            *i += 1;
            let mut m = BTreeMap::new();
            ws(b, i);
            if b[*i] == b'}' {
                *i += 1;
                return Json::Obj(m);
            }
            loop {
                ws(b, i);
                let Json::Str(k) = value(b, i) else {
                    panic!("object key at {i} is not a string")
                };
                ws(b, i);
                assert_eq!(b[*i], b':', "expected ':' at {i}");
                *i += 1;
                let v = value(b, i);
                assert!(m.insert(k.clone(), v).is_none(), "duplicate key {k:?}");
                ws(b, i);
                match b[*i] {
                    b',' => *i += 1,
                    b'}' => {
                        *i += 1;
                        return Json::Obj(m);
                    }
                    c => panic!("expected ',' or '}}' at {i}, got {:?}", c as char),
                }
            }
        }
        b'[' => {
            *i += 1;
            let mut a = Vec::new();
            ws(b, i);
            if b[*i] == b']' {
                *i += 1;
                return Json::Arr(a);
            }
            loop {
                a.push(value(b, i));
                ws(b, i);
                match b[*i] {
                    b',' => *i += 1,
                    b']' => {
                        *i += 1;
                        return Json::Arr(a);
                    }
                    c => panic!("expected ',' or ']' at {i}, got {:?}", c as char),
                }
            }
        }
        b'"' => {
            *i += 1;
            let mut s = String::new();
            loop {
                let c = b[*i];
                *i += 1;
                match c {
                    b'"' => return Json::Str(s),
                    b'\\' => {
                        let e = b[*i];
                        *i += 1;
                        match e {
                            b'"' => s.push('"'),
                            b'\\' => s.push('\\'),
                            b'/' => s.push('/'),
                            b'b' => s.push('\u{8}'),
                            b'f' => s.push('\u{c}'),
                            b'n' => s.push('\n'),
                            b'r' => s.push('\r'),
                            b't' => s.push('\t'),
                            b'u' => {
                                let h = std::str::from_utf8(&b[*i..*i + 4]).unwrap();
                                *i += 4;
                                s.push(char::from_u32(u32::from_str_radix(h, 16).unwrap()).unwrap());
                            }
                            _ => panic!("bad escape at {i}"),
                        }
                    }
                    c if c < 0x20 => panic!("raw control byte in string at {i}"),
                    _ => {
                        // Copy one UTF-8 scalar.
                        let start = *i - 1;
                        let mut end = *i;
                        while end < b.len() && (b[end] & 0xC0) == 0x80 {
                            end += 1;
                        }
                        s.push_str(std::str::from_utf8(&b[start..end]).unwrap());
                        *i = end;
                    }
                }
            }
        }
        b't' if b[*i..].starts_with(b"true") => {
            *i += 4;
            Json::Bool(true)
        }
        b'f' if b[*i..].starts_with(b"false") => {
            *i += 5;
            Json::Bool(false)
        }
        b'n' if b[*i..].starts_with(b"null") => {
            *i += 4;
            Json::Null
        }
        c if c == b'-' || c.is_ascii_digit() => {
            let start = *i;
            while *i < b.len() && matches!(b[*i], b'-' | b'+' | b'.' | b'e' | b'E' | b'0'..=b'9') {
                *i += 1;
            }
            let t = std::str::from_utf8(&b[start..*i]).unwrap().to_string();
            assert!(t.parse::<f64>().is_ok(), "bad number {t:?}");
            Json::Num(t)
        }
        c => panic!("unexpected {:?} at {i}", c as char),
    }
}

/// The one refusal-or-ok key an envelope carries, and its body.
pub fn envelope(text: &str) -> (String, Json) {
    let v = parse(text);
    let keys = v.keys();
    assert_eq!(keys.len(), 1, "envelope must have exactly one top-level key: {text}");
    let k = keys[0].to_string();
    assert!(
        matches!(k.as_str(), "ok" | "refusal" | "execution"),
        "unknown envelope kind {k:?}: {text}"
    );
    let body = v.get(&k).clone();
    (k, body)
}

/// Assert a transport result is a typed refusal with `code`, carries a
/// readable message and at least one repair, and holds no values.
pub fn assert_refusal(t: &fs_annus_wasm::Transport, kind: &str, code: &str) -> Json {
    let (k, body) = envelope(&t.envelope);
    assert_eq!(k, kind, "envelope kind: {}", t.envelope);
    assert_eq!(body.get("code").str(), code, "{}", t.envelope);
    assert!(!body.get("message").str().is_empty(), "{}", t.envelope);
    assert!(!body.get("ranked_repairs").arr().is_empty(), "{}", t.envelope);
    assert!(matches!(body.get("details"), Json::Obj(_)), "{}", t.envelope);
    assert!(t.values.is_empty(), "a refusal carries no values");
    body
}
