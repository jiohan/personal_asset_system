interface PlaceholderPageProps {
    title: string;
    slice: number;
}

export default function PlaceholderPage({ title, slice }: PlaceholderPageProps) {
    return (
        <div className="placeholder-page">
            <h2>{title} <span className="badge">Coming Soon</span></h2>
            <div className="card">
                <p>This feature is not yet available in the current version of the application.</p>
                <p>It will be activated in <strong>Slice {slice}</strong>.</p>
            </div>
        </div>
    );
}
