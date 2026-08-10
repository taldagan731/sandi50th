import Image from "next/image";

export function TalDedication() {
  return (
    <aside className="talDedication" aria-labelledby="tal-dedication-title">
      <div className="talDedicationGlow" aria-hidden="true" />
      <figure className="talDedicationPortrait">
        <Image
          src="/images/apatura-iris-purple-emperor.webp"
          alt="A male Apatura iris, the Purple Emperor butterfly, with its iridescent purple wings open"
          width={2400}
          height={1599}
          sizes="(max-width: 780px) 100vw, 46vw"
        />
        <figcaption>
          <em>Apatura iris</em> · photograph by{" "}
          <a href="https://commons.wikimedia.org/wiki/File:Purple_emperor_(Apatura_iris)_male.jpg" target="_blank" rel="noreferrer">Charles J. Sharp</a>
          {" "}· <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>
        </figcaption>
      </figure>

      <article className="talDedicationLetter">
        <span className="eyebrow">A DEDICATION FROM TAL</span>
        <h2 id="tal-dedication-title">For Sandi.</h2>

        <p>Sandi,</p>

        <p>I have known you for eight years, 16 percent of your life. I only wish it were more, because the experiences we have shared and the enmeshment of our lives are what I have always yearned for with you.</p>

        <p>You are the embodiment of beauty, inside and out. There is something magical about who you are and how you are; the way you think, the way you see the world, that attracts me to you like a moon to its planet and a planet to its star.</p>

        <p>You are my Venus, definitely my not-lobster. You are a poet inside, a beautiful <em>Apatura iris</em>. Not a spelling error, my love, but the most stunning purple butterfly in the world.</p>

        <p>Your soul’s aura is what I yearn to touch. Your smile is my heaven. Your touch and embrace align my atoms in the way they naturally ought to be. Your voice calms me and stirs me. Your mood shapes mine. You are the light to which I am attracted, the scent toward which I ascend, the presence I always wish to have near me. You are the woman I am the first recruit to defend, honor, and love.</p>

        <p>You are a girl in a woman’s body, something we hold in common, as I am a boy in a man’s body. We navigate this world with some sense of preserved innocence, and that is one of the things I love most about you. This is why we both love children so much. It is why you have a way with children that is so rare and profound.</p>

        <p>You penetrate into people’s souls with your magnetism and your good nature. People reveal themselves to you because they feel safe with you; they feel heard. You are blessed with the kiss of angels, and all who know you are lucky to have been touched by it.</p>

        <p>On your fiftieth birthday, I wanted to give you something meaningful: a lasting memory, a testament not just to what I think of you, but to what all those who love and care about you see in you.</p>

        <p>So, as you are reading this, pause. Go to your phone and type <a href="https://www.sandi50th.com">www.Sandi50th.com</a> into your browser.</p>

        <p>Yes, the past two months were not really just me working on my website. In fact, I finished mine weeks ago and have been spending very little time on it.</p>

        <p>Without further introduction, I’ll let you enjoy the fruits of love.</p>

        <p>Happy 50th birthday, my darling, my better half.</p>

        <p className="talDedicationSignature">Tal</p>
      </article>
    </aside>
  );
}
